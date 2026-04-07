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
import { logger } from '@/lib/logger'
import * as notificationService from '@/lib/services/notificationService'
import type {
  CreateEventProjectInput,
  UpdateEventProjectInput,
} from '@/lib/types/event-project'

import {
  buildApprovalGates,
  isAdminGateActionable,
  allGatesApproved,
  type GateState,
  type ApprovalGates,
  type GateType,
} from './eventProject-gates'

import {
  notifyTeamsOfPendingApproval,
  notifyCreatorOfGateChange,
} from './eventProject-notifications'

// The db cast is needed because the org-scoped extension models are not in the generated PrismaClient type
const db = prisma as unknown as OrgPrismaClient

const log = logger.child({ service: 'eventProjectService' })

// ─── Re-exports from sub-modules ────────────────────────────────────────────

export type { GateState, ApprovalGates, GateType } from './eventProject-gates'
export { buildApprovalGates, isAdminGateActionable, allGatesApproved } from './eventProject-gates'

export {
  notifyTeamsOfPendingApproval,
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
  const isDirectRequest = source === 'DIRECT_REQUEST'
  const requiresAV = !!(data as Record<string, unknown>).requiresAV
  const requiresFacilities = !!(data as Record<string, unknown>).requiresFacilities

  // Any event that needs AV or Facilities approval goes through the gate workflow,
  // regardless of source. Direct requests always require admin approval too.
  const needsGates = isDirectRequest || requiresAV || requiresFacilities
  const initialStatus = needsGates ? 'PENDING_APPROVAL' : 'CONFIRMED'
  const approvalGates = needsGates ? buildApprovalGates(requiresAV, requiresFacilities) : null

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
      areaId: data.areaId ?? null,
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
    notifyTeamsOfPendingApproval(project.title as string, project.id as string, approvalGates).catch(() => {})
  }

  // Auto-detect conflicts (fire-and-forget — results stored in metadata)
  runConflictDetection(project.id, data.startsAt, data.endsAt, data.roomId, data.buildingId).catch(() => {})

  // For events that don't need gates, auto-confirm by creating the CalendarEvent bridge
  if (!needsGates) {
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
  return db.eventProject.findFirst({
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
      area: { select: { id: true, name: true } },
      room: { select: { id: true, displayName: true, roomNumber: true } },
    },
  })
}

/**
 * Lists EventProjects with optional status filtering, ordered by start date.
 */
export async function listEventProjects(filters?: {
  status?: string
  campusId?: string
  schoolId?: string
  createdById?: string
}): Promise<Record<string, unknown>[]> {
  return db.eventProject.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.campusId ? { campusId: filters.campusId } : {}),
      ...(filters?.schoolId ? { schoolId: filters.schoolId } : {}),
      ...(filters?.createdById ? { createdById: filters.createdById } : {}),
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
 * Returns EventProjects that have a PENDING gate for the given gate type.
 * Used by team-specific approval queues (AV, Facilities).
 */
export async function listPendingGateApprovals(gateType: GateType): Promise<Record<string, unknown>[]> {
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

  // Filter to only those with a PENDING gate of the requested type
  return projects.filter((p: any) => {
    const gates = p.approvalGates as ApprovalGates | null
    if (!gates) return false
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

  const gates: ApprovalGates = existing.approvalGates ?? { admin: { status: 'PENDING' } }

  // Validate gate exists
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

  // Check if event should be fully confirmed
  const shouldConfirm = allGatesApproved(gates)

  const updateData: Record<string, unknown> = {
    approvalGates: gates,
  }
  if (shouldConfirm) {
    updateData.status = 'CONFIRMED'
    updateData.approvedById = approverId
    updateData.approvedAt = new Date()
  }

  const updated = await db.eventProject.update({
    where: { id: eventProjectId },
    data: updateData,
  })

  await appendActivityLog(eventProjectId, approverId, 'GATE_APPROVED', {
    gateType,
    allGatesCleared: shouldConfirm,
    gates,
  })

  // Notify the event creator (fire-and-forget)
  notifyCreatorOfGateChange(eventProjectId, gateType, 'APPROVED').catch(() => {})

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

  return updated
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

  const gates: ApprovalGates = existing.approvalGates ?? { admin: { status: 'PENDING' } }

  if (gateType !== 'admin' && !gates[gateType]) {
    throw new Error(`No ${gateType} gate exists on this event.`)
  }

  // Mark the gate as rejected
  const gate = gates[gateType]!
  gate.status = 'REJECTED'
  gate.respondedById = actorId
  gate.respondedAt = new Date().toISOString()
  gate.reason = reason

  // Send event back to DRAFT for revision
  const updated = await db.eventProject.update({
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

  // Notify the event creator (fire-and-forget)
  notifyCreatorOfGateChange(eventProjectId, gateType, 'REJECTED', reason).catch(() => {})

  return updated
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

  const gates: ApprovalGates = existing.approvalGates as ApprovalGates

  // Reset any rejected gates back to PENDING
  for (const key of ['av', 'facilities', 'admin'] as GateType[]) {
    const gate = gates[key]
    if (gate && gate.status === 'REJECTED') {
      gate.status = 'PENDING'
      gate.respondedById = null
      gate.respondedAt = null
      gate.reason = null
    }
  }

  const updated = await db.eventProject.update({
    where: { id: eventProjectId },
    data: {
      status: 'PENDING_APPROVAL',
      approvalGates: gates,
      rejectionReason: null,
    },
  })

  await appendActivityLog(eventProjectId, userId, 'RESUBMITTED', {
    gates,
  })

  // Re-notify teams of the resubmission
  const freshProject = await db.eventProject.findUnique({ where: { id: eventProjectId } })
  if (freshProject?.approvalGates) {
    notifyTeamsOfPendingApproval(freshProject.title, eventProjectId, freshProject.approvalGates as ApprovalGates).catch(() => {})
  }

  // Re-run conflict detection with potentially updated details
  if (freshProject) {
    runConflictDetection(
      eventProjectId,
      freshProject.startsAt,
      freshProject.endsAt,
      freshProject.roomId,
      freshProject.buildingId,
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
        areaId: project.areaId ?? null,
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
        areaId: project.areaId ?? null,
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
) {
  try {
    const project = await db.eventProject.findUnique({ where: { id: eventProjectId }, select: { organizationId: true } })
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
      await appendActivityLog(eventProjectId, 'system', 'CONFLICTS_DETECTED', {
        count: report.conflicts.length,
        types: report.conflicts.map((c: any) => c.type),
      })
    }
  } catch (err) {
    log.warn({ err, eventProjectId }, 'Auto conflict detection failed (non-fatal)')
  }
}
