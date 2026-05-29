/**
 * Event Project Service — Core CRUD & Approval Workflow
 *
 * This is the public API barrel for the EventProject domain.
 * Sub-modules handle specific concerns:
 *   - eventProject-gates.ts         — Gate types, builder, validation helpers
 *   - eventProject-notifications.ts — Team notification dispatch
 *   - eventProject-schedule.ts      — Schedule block & task CRUD, activity log queries
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import { logger } from '@/lib/logger'
import * as notificationService from '@/lib/services/notificationService'
import type {
  CreateEventProjectInput,
  UpdateEventProjectInput,
} from '@/lib/types/event-project'

import {
  buildApprovalGatesFromConfig,
  isAdminGateActionable,
  allGatesApproved,
  type GateState,
  type ApprovalGates,
  type GateType,
} from './eventProject-gates'

import {
  buildGatesFromFlow,
  isGateActionable,
  allGatesCleared,
  getApprovalFlowEntries,
  type GateStateV2,
} from './approvalFlowService'

import { resolveApprovalSteps, resolveFormApprovalSteps, getSystemFormId } from './approvalRuleService'

import {
  notifyTeamsOfPendingApproval,
  notifyTeamsOfEventInfo,
  notifyCreatorOfGateChange,
  notifyV2TeamsOfPendingApproval,
  notifyV2TeamsOfEventInfo,
} from './eventProject-notifications'

// The db cast is needed because the org-scoped extension models are not in the generated PrismaClient type
const db = prisma as unknown as OrgPrismaClient

const log = logger.child({ service: 'eventProjectService' })

// ─── V1 vs V2 Gate Detection ───────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Detects whether an approvalGates object uses V2 (team UUID keys) or V1
 * (channel-type strings like 'admin', 'av', 'facilities').
 */
function isV2Gates(gates: Record<string, unknown>): boolean {
  return Object.keys(gates).some((key) => UUID_RE.test(key))
}

// ─── Re-exports from sub-modules ────────────────────────────────────────────

export type { GateState, ApprovalGates, GateType } from './eventProject-gates'
export { buildApprovalGatesFromConfig, buildApprovalGates, isAdminGateActionable, allGatesApproved, GATE_META, GATE_TO_CHANNEL, CHANNEL_TO_GATE } from './eventProject-gates'

export {
  notifyTeamsOfPendingApproval,
  notifyTeamsOfEventInfo,
  notifyCreatorOfGateChange,
} from './eventProject-notifications'

export {
  getActivityLog,
  createScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
  createEventTask,
  updateEventTask,
} from './eventProject-schedule'

// ─── Activity Log ───────────────────────────────────────────────────────────

/**
 * Appends an immutable activity log entry to an EventProject.
 * This is the core audit trail mechanism — call it after EVERY mutation.
 * Rows are never updated or deleted.
 */
export async function appendActivityLog(
  eventProjectId: string,
  actorId: string,
  type: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.eventActivityLog.create({
    data: {
      eventProjectId,
      actorId,
      type,
      metadata: metadata ?? null,
    },
  })
}

// ─── EventProject CRUD ──────────────────────────────────────────────────────

/**
 * Creates a new EventProject from one of three sources:
 * - DIRECT_REQUEST: status = PENDING_APPROVAL (requires admin approval)
 * - PLANNING_SUBMISSION: status = CONFIRMED (auto-confirms via bulkPublish)
 * - SERIES: status = CONFIRMED (spawned from a series template)
 *
 * For PLANNING_SUBMISSION and SERIES sources, confirmEventProject is called
 * automatically to create the CalendarEvent bridge record.
 */
export async function createEventProject(
  data: CreateEventProjectInput,
  createdById: string,
  source: 'DIRECT_REQUEST' | 'PLANNING_SUBMISSION' | 'SERIES',
  sourceId?: string,
): Promise<Record<string, unknown>> {
  const requiresAV = !!(data as Record<string, unknown>).requiresAV
  const requiresFacilities = !!(data as Record<string, unknown>).requiresFacilities
  const requiresCustodial = !!(data as Record<string, unknown>).requiresCustodial
  const requiresSecurity = !!(data as Record<string, unknown>).requiresSecurity

  // Build gates from the org's approval flow.
  // V2 (team-based) is used when ApprovalFlowEntry rows exist.
  // Falls back to V1 (channel-based ApprovalChannelConfig) otherwise.
  const orgId = getOrgContextId()
  const needs = { requiresAV, requiresFacilities, requiresCustodial, requiresSecurity }

  const flowEntries = await getApprovalFlowEntries()
  const useV2 = flowEntries.length > 0

  let approvalGates: Record<string, unknown> | null = null
  let notifications: unknown[] = []

  if (useV2) {
    // Resolve which approval steps apply to THIS event's context
    const eventCtx = {
      schoolId: data.schoolId ?? null,
      campusId: data.campusId ?? null,
      category: (data as Record<string, unknown>).category as string | null ?? null,
      expectedAttendance: data.expectedAttendance ?? null,
      requiresAV,
      requiresFacilities,
      requiresCustodial,
      requiresSecurity,
      isOffCampus: !!(data as Record<string, unknown>).isOffCampus,
    }

    // Try form-scoped approval first
    // If the caller passed a formDefinitionId (they know which form was used), use it directly.
    // Otherwise fall back to guessing from the event type, then legacy global rules.
    let formId = (data as Record<string, unknown>).formDefinitionId as string | undefined
    if (!formId) {
      const systemKey = source === 'SERIES' ? 'recurring_event' : data.isMultiDay ? 'multiday_event' : 'single_event'
      formId = await getSystemFormId(orgId, systemKey) ?? undefined
    }
    const resolvedSteps = formId
      ? await resolveFormApprovalSteps(orgId, formId, eventCtx)
      : await resolveApprovalSteps(orgId, eventCtx)

    // Build gates only from the resolved steps' teams (not all flow entries)
    const result = await buildGatesFromFlow(needs, resolvedSteps)
    const hasActive = Object.values(result.gates).some((g) => g.status === 'PENDING')
    approvalGates = hasActive ? result.gates : null
    notifications = result.notifications
  } else {
    const result = await buildApprovalGatesFromConfig(orgId, needs)
    const hasActive = Object.values(result.gates).some((g) => g?.status === 'PENDING')
    approvalGates = hasActive ? (result.gates as unknown as Record<string, unknown>) : null
    notifications = result.notifications
  }

  const hasActiveGates = !!approvalGates
  const initialStatus = hasActiveGates ? 'PENDING_APPROVAL' : 'CONFIRMED'

  const project = await db.eventProject.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      isMultiDay: data.isMultiDay ?? false,
      expectedAttendance: data.expectedAttendance ?? null,
      locationText: data.locationText ?? null,
      buildingId: data.buildingId ?? null,
      spaceId: (data as { spaceId?: string; areaId?: string }).spaceId ?? data.areaId ?? null,
      roomId: data.roomId ?? null,
      campusId: data.campusId ?? null,
      schoolId: data.schoolId ?? null,
      calendarId: data.calendarId ?? null,
      status: initialStatus,
      source,
      sourceId: sourceId ?? null,
      createdById,
      requiresAV,
      requiresFacilities,
      approvalGates: approvalGates ?? undefined,
      metadata: data.metadata ?? null,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      scheduleBlocks: true,
      tasks: true,
      activityLog: { orderBy: { createdAt: 'desc' } },
    },
  })

  await appendActivityLog(project.id, createdById, 'CREATED', {
    source,
    sourceId: sourceId ?? null,
    initialStatus,
  })

  // Auto-add creator as Event Owner team member (fire-and-forget)
  db.eventTeamMember.create({
    data: {
      eventProjectId: project.id,
      userId: createdById,
      role: 'Event Owner',
      addedById: createdById,
    },
  }).catch(() => {})

  // Notify relevant teams when gates are active (fire-and-forget)
  if (approvalGates) {
    if (useV2) {
      // V2: gate keys are team IDs — notify team members directly
      notifyV2TeamsOfPendingApproval(
        project.title as string,
        project.id as string,
        approvalGates as Record<string, GateStateV2>,
      ).catch(() => {})
    } else {
      notifyTeamsOfPendingApproval(project.title as string, project.id as string, approvalGates as ApprovalGates).catch(() => {})
    }
  }

  // Send non-blocking notifications for NOTIFICATION-mode (fire-and-forget)
  if (useV2 && notifications.length > 0) {
    notifyV2TeamsOfEventInfo(
      project.title as string,
      project.id as string,
      notifications as Array<{ teamId: string; teamName: string }>,
    ).catch(() => {})
  } else if (!useV2 && notifications.length > 0) {
    notifyTeamsOfEventInfo(project.title as string, project.id as string, notifications as string[]).catch(() => {})
  }

  // Create invitation records for requested attendees (fire-and-forget)
  const meta = (data.metadata ?? {}) as Record<string, unknown>
  const requestedAttendees = Array.isArray(meta.requestedAttendees) ? meta.requestedAttendees as string[] : []
  if (requestedAttendees.length > 0) {
    import('./eventInvitationService').then(({ createEventInvitations }) =>
      createEventInvitations(
        project.id,
        requestedAttendees,
        createdById,
        (meta.peopleNote as string) ?? undefined,
      )
    ).catch(() => {})
  }

  // Auto-detect conflicts (fire-and-forget — results stored in metadata)
  runConflictDetection(project.id, data.startsAt, data.endsAt, data.roomId, data.buildingId, createdById).catch(() => {})

  // For events that don't need gates, auto-confirm by creating the CalendarEvent bridge
  if (!hasActiveGates) {
    await confirmEventProject(project.id, createdById)

    // Trigger Google Calendar sync for the creator (non-fatal)
    try {
      const { syncEventToCalendar } = await import(
        '@/lib/services/integrations/googleCalendarService'
      )
      await syncEventToCalendar(createdById, project.organizationId as string, project as unknown as import('@prisma/client').EventProject)
    } catch (err) {
      log.error({ err, eventProjectId: project.id }, 'Google Calendar sync failed after create — non-fatal')
    }
  }

  return project
}

/**
 * Fetches a single EventProject with full nested data.
 */
export async function getEventProject(id: string): Promise<Record<string, unknown> | null> {
  const project = await db.eventProject.findFirst({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      scheduleBlocks: {
        orderBy: { startsAt: 'asc' },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      tasks: {
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      activityLog: {
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      teamMembers: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, jobTitle: true } },
          addedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      room: { select: { id: true, displayName: true, roomNumber: true } },
    },
  })

  if (!project) return null

  // Enrich approvalGates entries with respondedByName for display.
  // We don't store names in the JSON to avoid stale data on rename.
  const enrichedGates = await enrichGatesWithApproverNames(
    project.approvalGates as Record<string, Record<string, unknown>> | null,
  )

  return enrichedGates
    ? { ...project, approvalGates: enrichedGates }
    : project
}

/**
 * Look up approver names for any gate entries that have a respondedById.
 * Returns a new gates object with `respondedByName` populated, or null if
 * the input was null. Safe for both V1 (channel-keyed) and V2 (UUID-keyed) shapes.
 */
async function enrichGatesWithApproverNames(
  gates: Record<string, Record<string, unknown>> | null,
): Promise<Record<string, Record<string, unknown>> | null> {
  if (!gates) return null

  const userIds = new Set<string>()
  for (const gate of Object.values(gates)) {
    const id = gate?.respondedById
    if (typeof id === 'string' && id.length > 0) userIds.add(id)
  }

  if (userIds.size === 0) return gates

  const users = await db.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, firstName: true, lastName: true },
  })

  const nameById = new Map<string, string>()
  for (const u of users) {
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
    if (full) nameById.set(u.id, full)
  }

  const next: Record<string, Record<string, unknown>> = {}
  for (const [key, gate] of Object.entries(gates)) {
    const id = typeof gate?.respondedById === 'string' ? gate.respondedById : null
    next[key] = id && nameById.has(id)
      ? { ...gate, respondedByName: nameById.get(id) }
      : gate
  }
  return next
}

/**
 * Lists EventProjects with optional status filtering, ordered by start date.
 *
 * School filter semantics: when schoolId is provided, returns events whose
 * schoolId matches OR is null (null = district-wide, shown in every school's
 * view). Callers that want a strict per-school match should use a Prisma-level
 * query directly; this helper powers the Events Hub which must surface
 * all-schools events alongside the active school.
 */
export async function listEventProjects(filters?: {
  status?: string
  campusId?: string
  schoolId?: string
  createdById?: string
}): Promise<Record<string, unknown>[]> {
  const andClauses: Record<string, unknown>[] = []
  if (filters?.campusId) {
    andClauses.push({ OR: [{ campusId: filters.campusId }, { campusId: null }] })
  }
  if (filters?.schoolId) {
    andClauses.push({ OR: [{ schoolId: filters.schoolId }, { schoolId: null }] })
  }

  return db.eventProject.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.createdById ? { createdById: filters.createdById } : {}),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { tasks: true, scheduleBlocks: true, teamMembers: true } },
    },
    orderBy: { startsAt: 'asc' },
  })
}

/**
 * Returns EventProjects that have a PENDING gate for the given gate type or team ID.
 * Used by team-specific approval queues (AV, Facilities for V1; team UUIDs for V2).
 *
 * @param gateType - V1 channel-type gate key ('admin', 'av', 'facilities', etc.)
 * @param teamId  - V2 team UUID. When provided, filters by this key instead of gateType.
 */
export async function listPendingGateApprovals(
  gateType: GateType,
  teamId?: string,
): Promise<Record<string, unknown>[]> {
  // Fetch all PENDING_APPROVAL projects that have approvalGates
  const projects = await db.eventProject.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      approvalGates: { not: null },
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, displayName: true, roomNumber: true } },
      _count: { select: { tasks: true, scheduleBlocks: true } },
    },
    orderBy: { startsAt: 'asc' },
  })

  // Filter to only those with a PENDING gate of the requested type/team
  return projects.filter((p: Record<string, unknown>) => {
    const gates = p.approvalGates as Record<string, { status: string }> | null
    if (!gates) return false

    if (teamId) {
      // V2: look up by team UUID key
      const gate = gates[teamId]
      return gate && gate.status === 'PENDING'
    }

    // V1: look up by channel-type key
    const gate = gates[gateType]
    return gate && gate.status === 'PENDING'
  })
}

/**
 * Counts EventProjects with a PENDING gate for the given type.
 * Used for sidebar badge counts.
 */
export async function countPendingGateApprovals(gateType: GateType): Promise<number> {
  const items = await listPendingGateApprovals(gateType)
  return items.length
}

/**
 * Updates an EventProject's fields.
 * Compares old vs new values to build detailed metadata for the activity log.
 */
export async function updateEventProject(
  id: string,
  data: UpdateEventProjectInput,
  actorId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)

  // Track which fields changed for the activity log
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = []
  const updateData: Record<string, unknown> = {}

  const trackableFields: Array<keyof UpdateEventProjectInput> = [
    'title',
    'description',
    'startsAt',
    'endsAt',
    'isMultiDay',
    'expectedAttendance',
    'locationText',
    'buildingId',
    'areaId',
    'roomId',
    'campusId',
    'schoolId',
    'calendarId',
  ]

  for (const field of trackableFields) {
    if (field in data) {
      const newVal = data[field]
      const oldVal = existing[field]
      if (newVal !== oldVal) {
        changes.push({ field, oldValue: oldVal ?? null, newValue: newVal ?? null })
      }
      updateData[field] = newVal ?? null
    }
  }

  // Handle metadata separately (not tracked field-by-field)
  if ('metadata' in data) {
    updateData.metadata = data.metadata ?? null
  }

  const updated = await db.eventProject.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  if (changes.length > 0) {
    await appendActivityLog(id, actorId, 'FIELD_UPDATED', { changes })
  }

  // If dates changed, recalculate notification rule scheduledAt times
  const datesChanged = changes.some((c) => c.field === 'startsAt' || c.field === 'endsAt')
  if (datesChanged) {
    try {
      const { recalculateRulesForEvent } = await import(
        '@/lib/services/notificationOrchestrationService'
      )
      const rescheduleResults = await recalculateRulesForEvent(id)
      if (rescheduleResults.length > 0) {
        await appendActivityLog(id, actorId, 'NOTIFICATION_RULES_RECALCULATED', {
          rulesAdjusted: rescheduleResults.length,
          changes: rescheduleResults,
        })
      }
    } catch (err) {
      // Non-fatal — notification recalculation failure should not block the date update
      log.error({ err, eventProjectId: id }, 'Failed to recalculate notification rules after reschedule')
    }
  }

  return updated
}

// ─── Approval Workflow ──────────────────────────────────────────────────────

/**
 * Approves a PENDING_APPROVAL EventProject.
 *
 * If the project has approval gates (multi-gate workflow), delegates to
 * approveGate('admin', ...) which enforces prerequisite checks.
 *
 * Legacy behavior (no gates): transitions directly to CONFIRMED and creates
 * the CalendarEvent bridge.
 */
export async function approveEventProject(
  id: string,
  approverId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)
  if (existing.status !== 'PENDING_APPROVAL') {
    throw new Error(
      `Cannot approve EventProject in status ${existing.status}. Expected PENDING_APPROVAL.`,
    )
  }

  // If gates exist, use the multi-gate workflow (approve admin gate)
  if (existing.approvalGates) {
    return approveGate(id, 'admin', approverId)
  }

  // Legacy: direct approval (no gates)
  const updated = await db.eventProject.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      approvedById: approverId,
      approvedAt: new Date(),
    },
  })

  await appendActivityLog(id, approverId, 'APPROVAL_GRANTED', {
    fromStatus: 'PENDING_APPROVAL',
    toStatus: 'CONFIRMED',
  })

  // Create the CalendarEvent bridge now that it's approved
  await confirmEventProject(id, approverId)

  // Trigger Google Calendar sync for the approver (non-fatal)
  try {
    const { syncEventToCalendar } = await import(
      '@/lib/services/integrations/googleCalendarService'
    )
    const freshProject = await db.eventProject.findUnique({ where: { id } })
    if (freshProject) {
      await syncEventToCalendar(approverId, freshProject.organizationId, freshProject)
    }
  } catch (err) {
    log.error({ err, eventProjectId: id }, 'Google Calendar sync failed after approval — non-fatal')
  }

  return updated
}

/**
 * Rejects a PENDING_APPROVAL EventProject, setting status to CANCELLED.
 */
export async function rejectEventProject(
  id: string,
  actorId: string,
  reason?: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)

  const updated = await db.eventProject.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  await appendActivityLog(id, actorId, 'APPROVAL_REJECTED', {
    fromStatus: existing.status,
    toStatus: 'CANCELLED',
    reason: reason ?? null,
  })

  // Remove from all users' Google Calendars (fire-and-forget)
  const orgId = existing.organizationId as string
  if (orgId) {
    const { removeEventProjectFromCalendars } = await import(
      '@/lib/services/integrations/googleCalendarService'
    )
    removeEventProjectFromCalendars(orgId, id).catch(() => {})
  }

  return updated
}

// ─── Kanban board transitions ───────────────────────────────────────────────

/**
 * Safe status transitions used by the kanban board's drag-and-drop.
 *
 * Only transitions that DON'T require human review are listed here.
 * Approval-adjacent transitions (anything that lands in CONFIRMED from
 * PENDING_APPROVAL) must go through `approveEventProject` / the gates
 * system, which enforces the Review Approval drawer flow.
 *
 * Format: `${from}->${to}`
 */
const ALLOWED_TRANSITIONS = new Set<string>([
  // Submit draft for review / withdraw back to draft
  'DRAFT->PENDING_APPROVAL',
  'PENDING_APPROVAL->DRAFT',

  // Mark a confirmed event as started / revert
  'CONFIRMED->IN_PROGRESS',
  'IN_PROGRESS->CONFIRMED',

  // Mark an in-progress event as completed
  'IN_PROGRESS->COMPLETED',
])

type TransitionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

/**
 * Transitions an EventProject between safe statuses (used by kanban drag-drop).
 *
 * Throws if the transition is not in the allowlist — specifically, approvals
 * are NOT allowed here (use `approveEventProject` via the Review Approval
 * drawer).
 */
export async function transitionEventProject(
  id: string,
  toStatus: TransitionStatus,
  actorId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)

  const fromStatus = existing.status as TransitionStatus
  const key = `${fromStatus}->${toStatus}`

  // Guard: prevent duplicate submission when already pending approval
  if (fromStatus === 'PENDING_APPROVAL' && toStatus === 'PENDING_APPROVAL') {
    throw new Error(
      'This event is already pending approval. It cannot be submitted again until the current review is complete.',
    )
  }

  if (!ALLOWED_TRANSITIONS.has(key)) {
    throw new Error(
      `Transition ${key} is not allowed. Approvals must go through the Review Approval drawer.`,
    )
  }

  const updated = await db.eventProject.update({
    where: { id },
    data: { status: toStatus },
  })

  await appendActivityLog(id, actorId, 'STATUS_CHANGED', {
    fromStatus,
    toStatus,
    via: 'kanban-drag',
  })

  return updated
}

/**
 * Approves a specific gate on an EventProject.
 *
 * Rules:
 * - AV/Facilities gates can be approved independently
 * - Admin gate can only be approved if all prerequisite gates are cleared
 * - If all gates are now approved, event transitions to CONFIRMED
 */
export async function approveGate(
  eventProjectId: string,
  gateType: GateType,
  approverId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  if (!existing) throw new Error(`EventProject not found: ${eventProjectId}`)
  if (existing.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve gate on EventProject in status ${existing.status}. Expected PENDING_APPROVAL.`)
  }

  const rawGates: Record<string, unknown> = existing.approvalGates ?? { admin: { status: 'PENDING' } }
  const v2 = isV2Gates(rawGates)

  let shouldConfirm: boolean
  let gateLabel: string

  if (v2) {
    // ── V2: team-based gates (gateType is passed as a team UUID) ──
    const gates = rawGates as Record<string, GateStateV2>
    const gateKey = gateType as string // team UUID

    if (!gates[gateKey]) {
      throw new Error(`No gate exists for team ${gateKey} on this event.`)
    }

    // Prerequisite check: all lower-sortOrder gates must be cleared
    if (!isGateActionable(gateKey, gates)) {
      const blocking = Object.entries(gates)
        .filter(([k, g]) => k !== gateKey && g.sortOrder < gates[gateKey].sortOrder && g.status !== 'APPROVED' && g.status !== 'SKIPPED')
        .map(([, g]) => g.teamName)
      throw new Error(`Cannot approve this gate yet. Waiting on: ${blocking.join(', ')}`)
    }

    // Update the gate immutably
    gates[gateKey] = {
      ...gates[gateKey],
      status: 'APPROVED',
      respondedById: approverId,
      respondedAt: new Date().toISOString(),
    }

    shouldConfirm = allGatesCleared(gates)
    gateLabel = gates[gateKey].teamName

    const updateData: Record<string, unknown> = { approvalGates: gates }
    if (shouldConfirm) {
      updateData.status = 'CONFIRMED'
      updateData.approvedById = approverId
      updateData.approvedAt = new Date()
    }

    await db.eventProject.update({ where: { id: eventProjectId }, data: updateData })

    await appendActivityLog(eventProjectId, approverId, 'GATE_APPROVED', {
      gateType: gateKey,
      teamName: gateLabel,
      allGatesCleared: shouldConfirm,
      gates,
    })

    // Notify creator with V2 team name
    notifyCreatorOfGateChange(eventProjectId, gateType, 'APPROVED', undefined, gateLabel).catch(() => {})
  } else {
    // ── V1: channel-type gates (original logic) ──
    const gates = rawGates as ApprovalGates

    if (gateType !== 'admin' && !gates[gateType]) {
      throw new Error(`No ${gateType} gate exists on this event. It may not require ${gateType} approval.`)
    }

    // Admin gate: check prerequisites
    if (gateType === 'admin' && !isAdminGateActionable(gates)) {
      const pendingGates: string[] = []
      if (gates.av && gates.av.status === 'PENDING') pendingGates.push('AV')
      if (gates.facilities && gates.facilities.status === 'PENDING') pendingGates.push('Facilities')
      throw new Error(`Cannot approve admin gate. Waiting on: ${pendingGates.join(', ')}`)
    }

    // Update the gate
    const gate = gates[gateType]!
    gate.status = 'APPROVED'
    gate.respondedById = approverId
    gate.respondedAt = new Date().toISOString()

    shouldConfirm = allGatesApproved(gates)

    const updateData: Record<string, unknown> = { approvalGates: gates }
    if (shouldConfirm) {
      updateData.status = 'CONFIRMED'
      updateData.approvedById = approverId
      updateData.approvedAt = new Date()
    }

    await db.eventProject.update({ where: { id: eventProjectId }, data: updateData })

    await appendActivityLog(eventProjectId, approverId, 'GATE_APPROVED', {
      gateType,
      allGatesCleared: shouldConfirm,
      gates,
    })

    // Notify creator (V1)
    notifyCreatorOfGateChange(eventProjectId, gateType, 'APPROVED').catch(() => {})
  }

  // If fully approved, create CalendarEvent bridge + sync + post-approval automations
  if (shouldConfirm) {
    await confirmEventProject(eventProjectId, approverId)

    // Google Calendar sync (non-fatal)
    try {
      const { syncEventToCalendar } = await import(
        '@/lib/services/integrations/googleCalendarService'
      )
      const freshProject = await db.eventProject.findUnique({ where: { id: eventProjectId } })
      if (freshProject) {
        await syncEventToCalendar(approverId, freshProject.organizationId, freshProject)
      }
    } catch (err) {
      log.error({ err, eventProjectId }, 'Google Calendar sync failed after gate approval — non-fatal')
    }

    // Post-approval automations: notify creator, email attendees, etc. (fire-and-forget)
    import('@/lib/services/eventPostApprovalService').then(({ runPostApprovalAutomations }) => {
      runPostApprovalAutomations({ eventProjectId, approverId }).catch(() => {})
    }).catch(() => {})
  }

  // Re-fetch for consistent return shape
  const updated = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  return updated as Record<string, unknown>
}

/**
 * Rejects a specific gate on an EventProject.
 * Sends the event back to DRAFT so the submitter can revise and resubmit.
 * Only resets the rejected gate — other approved gates are preserved.
 */
export async function rejectGate(
  eventProjectId: string,
  gateType: GateType,
  actorId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  if (!existing) throw new Error(`EventProject not found: ${eventProjectId}`)
  if (existing.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot reject gate on EventProject in status ${existing.status}. Expected PENDING_APPROVAL.`)
  }

  const rawGates: Record<string, unknown> = existing.approvalGates ?? { admin: { status: 'PENDING' } }
  const v2 = isV2Gates(rawGates)

  let gateLabel: string | undefined

  if (v2) {
    // ── V2: team-based gates ──
    const gates = rawGates as Record<string, GateStateV2>
    const gateKey = gateType as string

    if (!gates[gateKey]) {
      throw new Error(`No gate exists for team ${gateKey} on this event.`)
    }

    gateLabel = gates[gateKey].teamName

    gates[gateKey] = {
      ...gates[gateKey],
      status: 'REJECTED',
      respondedById: actorId,
      respondedAt: new Date().toISOString(),
      reason,
    }

    await db.eventProject.update({
      where: { id: eventProjectId },
      data: {
        status: 'DRAFT',
        approvalGates: gates,
        rejectionReason: reason,
      },
    })

    await appendActivityLog(eventProjectId, actorId, 'GATE_REJECTED', {
      gateType: gateKey,
      teamName: gateLabel,
      reason,
      gates,
    })

    notifyCreatorOfGateChange(eventProjectId, gateType, 'REJECTED', reason, gateLabel).catch(() => {})
  } else {
    // ── V1: channel-type gates ──
    const gates = rawGates as ApprovalGates

    if (gateType !== 'admin' && !gates[gateType]) {
      throw new Error(`No ${gateType} gate exists on this event.`)
    }

    const gate = gates[gateType]!
    gate.status = 'REJECTED'
    gate.respondedById = actorId
    gate.respondedAt = new Date().toISOString()
    gate.reason = reason

    await db.eventProject.update({
      where: { id: eventProjectId },
      data: {
        status: 'DRAFT',
        approvalGates: gates,
        rejectionReason: reason,
      },
    })

    await appendActivityLog(eventProjectId, actorId, 'GATE_REJECTED', {
      gateType,
      reason,
      gates,
    })

    notifyCreatorOfGateChange(eventProjectId, gateType, 'REJECTED', reason).catch(() => {})
  }

  const updated = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  return updated as Record<string, unknown>
}

/**
 * Resubmits an event after revision following a rejection.
 * Resets only the rejected gate(s) back to PENDING, preserving approved gates.
 * Transitions status from DRAFT back to PENDING_APPROVAL.
 */
export async function resubmitForApproval(
  eventProjectId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  if (!existing) throw new Error(`EventProject not found: ${eventProjectId}`)
  if (existing.status !== 'DRAFT') {
    throw new Error(`Cannot resubmit EventProject in status ${existing.status}. Expected DRAFT.`)
  }
  if (existing.createdById !== userId) {
    throw new Error('Only the creator can resubmit for approval.')
  }
  if (!existing.approvalGates) {
    throw new Error('No approval gates found. Use the standard submission flow.')
  }

  const rawGates = existing.approvalGates as Record<string, unknown>
  const v2 = isV2Gates(rawGates)

  // Reset any rejected gates back to PENDING — works for both V1 and V2
  // by iterating all keys dynamically instead of hardcoded channel names
  if (v2) {
    const gates = rawGates as Record<string, GateStateV2>
    for (const key of Object.keys(gates)) {
      if (gates[key].status === 'REJECTED') {
        gates[key] = {
          ...gates[key],
          status: 'PENDING',
          respondedById: null,
          respondedAt: null,
          reason: null,
        }
      }
    }
  } else {
    const gates = rawGates as ApprovalGates
    for (const key of Object.keys(gates) as GateType[]) {
      const gate = gates[key]
      if (gate && gate.status === 'REJECTED') {
        gate.status = 'PENDING'
        gate.respondedById = null
        gate.respondedAt = null
        gate.reason = null
      }
    }
  }

  const updated = await db.eventProject.update({
    where: { id: eventProjectId },
    data: {
      status: 'PENDING_APPROVAL',
      approvalGates: rawGates,
      rejectionReason: null,
    },
  })

  await appendActivityLog(eventProjectId, userId, 'RESUBMITTED', {
    gates: rawGates,
  })

  // Re-notify teams of the resubmission
  const freshProject = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  if (freshProject?.approvalGates) {
    if (v2) {
      notifyV2TeamsOfPendingApproval(freshProject.title, eventProjectId, freshProject.approvalGates as Record<string, GateStateV2>).catch(() => {})
    } else {
      notifyTeamsOfPendingApproval(freshProject.title, eventProjectId, freshProject.approvalGates as ApprovalGates).catch(() => {})
    }
  }

  // Re-run conflict detection with potentially updated details
  if (freshProject) {
    runConflictDetection(
      eventProjectId,
      freshProject.startsAt,
      freshProject.endsAt,
      freshProject.roomId,
      freshProject.buildingId,
      userId,
    ).catch(() => {})
  }

  return updated
}

// ─── Calendar Bridge ────────────────────────────────────────────────────────

/**
 * Creates a CalendarEvent bridge record linking this EventProject to the calendar.
 * This is the ONLY place CalendarEvents should be created for EventProjects.
 * Sets sourceModule='event-project' and sourceId=project.id for the bridge pattern.
 *
 * If the project has no calendarId, falls back to the org's first active default calendar.
 * If no calendar exists, logs a warning and skips creation.
 */
export async function confirmEventProject(
  id: string,
  actorId: string,
): Promise<void> {
  const project = await db.eventProject.findUnique({ where: { id } })
  if (!project) throw new Error(`EventProject not found: ${id}`)

  let resolvedCalendarId = project.calendarId

  if (!resolvedCalendarId) {
    // Fall back to first active calendar in the org (prefer isDefault=true)
    const defaultCalendar = await db.calendar.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })

    if (!defaultCalendar) {
      log.warn(
        { eventProjectId: id },
        'No calendar found — skipping CalendarEvent bridge creation',
      )
      await appendActivityLog(id, actorId, 'STATUS_CHANGE', {
        fromStatus: project.status,
        toStatus: 'CONFIRMED',
        note: 'No calendar available — bridge skipped',
      })
      return
    }

    resolvedCalendarId = defaultCalendar.id
  }

  // Check if a bridge already exists (possibly soft-deleted) — restore it instead of creating a duplicate
  const existingBridge = await rawPrisma.calendarEvent.findFirst({
    where: {
      sourceModule: 'event-project',
      sourceId: project.id,
      organizationId: project.organizationId,
    },
  })

  if (existingBridge) {
    // Restore the soft-deleted bridge and update it with current project data
    await rawPrisma.calendarEvent.update({
      where: { id: existingBridge.id },
      data: {
        deletedAt: null,
        calendarId: resolvedCalendarId,
        title: project.title,
        description: project.description ?? null,
        startTime: project.startsAt,
        endTime: project.endsAt,
        calendarStatus: 'CONFIRMED',
        locationText: project.locationText ?? null,
        buildingId: project.buildingId ?? null,
        spaceId: project.spaceId ?? null,
        metadata: { eventProjectId: project.id },
      },
    })
  } else {
    await db.calendarEvent.create({
      data: {
        calendarId: resolvedCalendarId,
        title: project.title,
        description: project.description ?? null,
        startTime: project.startsAt,
        endTime: project.endsAt,
        isAllDay: false,
        calendarStatus: 'CONFIRMED',
        sourceModule: 'event-project',
        sourceId: project.id,
        createdById: actorId,
        locationText: project.locationText ?? null,
        buildingId: project.buildingId ?? null,
        spaceId: project.spaceId ?? null,
        metadata: { eventProjectId: project.id },
      },
    })
  }

  await appendActivityLog(id, actorId, 'STATUS_CHANGE', {
    fromStatus: project.status,
    toStatus: 'CONFIRMED',
    calendarId: resolvedCalendarId,
    bridgeCreated: true,
    restoredExisting: !!existingBridge,
  })
}

// ─── Auto Conflict Detection ─────────────────────────────────────────────────

/**
 * Runs conflict detection for an event and stores results in metadata.
 * Called fire-and-forget at creation and resubmission time.
 */
async function runConflictDetection(
  eventProjectId: string,
  startsAt: Date | string,
  endsAt: Date | string,
  roomId?: string | null,
  buildingId?: string | null,
  actorId?: string,
) {
  try {
    const project = await db.eventProject.findUnique({
      where: { id: eventProjectId },
      select: { organizationId: true, createdById: true },
    })
    if (!project) return

    const { detectConflicts } = await import('@/lib/services/ai/eventAIService')
    const report = await detectConflicts({
      eventProjectId,
      startsAt: typeof startsAt === 'string' ? startsAt : startsAt.toISOString(),
      endsAt: typeof endsAt === 'string' ? endsAt : endsAt.toISOString(),
      roomId: roomId ?? undefined,
      buildingId: buildingId ?? undefined,
      organizationId: project.organizationId,
    })

    // Store conflict report in metadata for the overview UI
    const existing = await db.eventProject.findUnique({ where: { id: eventProjectId }, select: { metadata: true } })
    const metadata = (existing?.metadata as Record<string, unknown>) ?? {}
    metadata.conflictReport = report
    metadata.conflictCheckedAt = new Date().toISOString()

    await db.eventProject.update({
      where: { id: eventProjectId },
      data: { metadata },
    })

    if (report.conflicts.length > 0) {
      await appendActivityLog(eventProjectId, actorId ?? project.createdById, 'CONFLICTS_DETECTED', {
        count: report.conflicts.length,
        types: report.conflicts.map((c: any) => c.type),
      })
    }
  } catch (err) {
    log.warn({ err, eventProjectId }, 'Auto conflict detection failed (non-fatal)')
  }
}
