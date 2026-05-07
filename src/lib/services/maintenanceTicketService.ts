/**
 * Maintenance Ticket Service
 *
 * Core business logic for the maintenance ticket lifecycle:
 * - Ticket creation with auto-generated MT-XXXX numbers
 * - 8-status state machine with validated transitions
 * - Specialty routing and self-claim guard
 * - Activity logging for every state change, comment, and assignment
 * - Notification dispatch (fire-and-forget)
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'
import { rawPrisma, prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { assertCan, canAny } from '@/lib/auth/permissions'
import { startOfDay } from 'date-fns'
import type { PmRecurrenceType } from '@/lib/types/pm-schedule'
import type { TicketSnapshot } from '@/lib/services/maintenanceNotificationService'
import type {
  MaintenanceTicketStatus,
  MaintenanceCategory,
  MaintenanceSpecialty,
  MaintenancePriority,
  HoldReason,
} from '@prisma/client'

// Re-export from extracted modules so existing imports don't break
export { CATEGORY_TO_SPECIALTY, ALLOWED_TRANSITIONS } from './maintenanceTicketStateMachine'
export type { TransitionConfig } from './maintenanceTicketStateMachine'
export { getTicketDetail, listTickets, TICKET_INCLUDES } from './maintenanceTicketQueries'

import { CATEGORY_TO_SPECIALTY, ALLOWED_TRANSITIONS } from './maintenanceTicketStateMachine'
import { TICKET_INCLUDES } from './maintenanceTicketQueries'

const log = logger.child({ service: 'maintenanceTicketService' })

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const CreateTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum([
    'ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL',
    'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  photos: z.array(z.string().url()).max(5).default([]),
  buildingId: z.string().optional(),
  spaceId: z.string().optional(),
  /** @deprecated Phase 1b — use spaceId */
  areaId: z.string().optional(),
  roomId: z.string().optional(),
  schoolId: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  availabilityNote: z.string().optional(),
  assetId: z.string().optional(),  // Optional link to a MaintenanceAsset
  customFields: z.record(z.string(), z.unknown()).optional(),  // Category-scoped dynamic field values
})

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>

// ─── Generate Ticket Number ───────────────────────────────────────────────────

export async function generateTicketNumber(orgId: string): Promise<string> {
  const result = await rawPrisma.$transaction(async (tx) => {
    const counter = await tx.maintenanceCounter.upsert({
      where: { organizationId: orgId },
      update: { lastTicketNumber: { increment: 1 } },
      create: { organizationId: orgId, lastTicketNumber: 1 },
    })
    return counter.lastTicketNumber
  })
  return `MT-${String(result).padStart(4, '0')}`
}

// ─── Create Ticket ────────────────────────────────────────────────────────────

export async function createMaintenanceTicket(
  input: unknown,
  userId: string,
  orgId: string
) {
  const data = CreateTicketSchema.parse(input)
  const ticketNumber = await generateTicketNumber(orgId)
  const specialty = CATEGORY_TO_SPECIALTY[data.category as MaintenanceCategory]
  const initialStatus: MaintenanceTicketStatus = data.scheduledDate ? 'SCHEDULED' : 'BACKLOG'

  const ticket = await prisma.maintenanceTicket.create({
    data: {
      organizationId: orgId,
      ticketNumber,
      title: data.title,
      description: data.description,
      category: data.category as MaintenanceCategory,
      specialty,
      priority: data.priority as MaintenancePriority,
      photos: data.photos,
      buildingId: data.buildingId,
      spaceId: data.spaceId ?? data.areaId,
      roomId: data.roomId,
      campusId: data.schoolId,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      availabilityNote: data.availabilityNote,
      assetId: data.assetId ?? null,
      customFields: data.customFields ?? undefined,
      status: initialStatus,
      submittedById: userId,
    },
    include: { ...TICKET_INCLUDES, activities: true },
  })

  // Initial activity log
  await rawPrisma.maintenanceTicketActivity.create({
    data: {
      organizationId: orgId,
      ticketId: ticket.id,
      actorId: userId,
      type: 'STATUS_CHANGE',
      toStatus: initialStatus,
      content: `Ticket created with status ${initialStatus}`,
    },
  })

  // Compute and set SLA due dates
  import('@/lib/services/slaService').then(({ computeSLADueDates }) => {
    computeSLADueDates(orgId, 'MAINTENANCE', data.category, ticket.createdAt)
      .then(async ({ slaResponseDue, slaResolveDue }) => {
        if (slaResponseDue || slaResolveDue) {
          await rawPrisma.maintenanceTicket.update({
            where: { id: ticket.id },
            data: { slaResponseDue, slaResolveDue },
          })
        }
      })
      .catch((err: unknown) => log.error({ err: String(err) }, 'SLA computation failed'))
  }).catch(() => {})

  // Auto-add submitter as watcher
  await rawPrisma.maintenanceTicketWatcher.create({
    data: {
      organizationId: orgId,
      ticketId: ticket.id,
      userId,
    },
  }).catch(() => {}) // Ignore if already exists

  // Check for approval rules — if gates are needed, set PENDING_APPROVAL and skip routing
  let needsApproval = false
  try {
    const { resolveMaintenanceApprovalSteps } = await import('./approvalRuleService')
    const { buildGatesFromFlow } = await import('./approvalFlowService')
    const ticketCtx = {
      schoolId: data.schoolId ?? null,
      campusId: data.schoolId ?? null, // campusId stored as schoolId in create
      category: data.category,
      priority: data.priority,
      buildingId: data.buildingId ?? null,
      estimatedRepairCostUSD: null, // not available at creation time
    }
    const resolvedSteps = await resolveMaintenanceApprovalSteps(orgId, ticketCtx)
    if (resolvedSteps.length > 0) {
      const { gates } = await buildGatesFromFlow({}, resolvedSteps)
      const hasActiveGates = Object.values(gates).some((g: { status: string }) => g.status === 'PENDING')
      if (hasActiveGates) {
        await rawPrisma.maintenanceTicket.update({
          where: { id: ticket.id },
          data: { status: 'PENDING_APPROVAL', approvalGates: JSON.parse(JSON.stringify(gates)) },
        })
        needsApproval = true
        log.info({ ticketId: ticket.id, gateCount: Object.keys(gates).length }, 'Ticket requires approval')
      }
    }
  } catch (err) {
    log.error({ err: String(err), ticketId: ticket.id }, 'Approval check failed — proceeding without gates')
  }

  // Attempt auto-routing only if approval is not needed (routing runs after approval clears)
  if (!needsApproval) {
  import('@/lib/services/ticketRoutingService').then(({ routeTicket }) => {
    routeTicket({
      module: 'MAINTENANCE',
      ticketId: ticket.id,
      categoryKey: data.category,
      buildingId: data.buildingId ?? null,
      submittedById: userId,
      orgId,
    }).then(async (routingResult) => {
      if (routingResult.assignedToId) {
        await prisma.maintenanceTicket.update({
          where: { id: ticket.id },
          data: { assignedToId: routingResult.assignedToId },
        })
        log.info({ ticketId: ticket.id, assignedTo: routingResult.assignedToId, reason: routingResult.reason }, 'Auto-routed maintenance ticket')
      }
    }).catch((err: unknown) =>
      log.error({ err: String(err), ticketId: ticket.id }, 'Auto-routing failed')
    )
  }).catch((err: unknown) =>
    log.error({ err: String(err) }, 'ticketRoutingService import failed')
  )
  } // end if (!needsApproval)

  // Phase 29: Post maintenance alert to the Facility Maintenance team auto-channel
  import('@/lib/services/systemBotService').then(({ postMaintenanceAlert }) => {
    prisma.team.findFirst({
      where: { organizationId: orgId, slug: 'maintenance' },
      select: { id: true },
    }).then((maintenanceTeam) => {
      postMaintenanceAlert(ticket.id, ticket.title, maintenanceTeam?.id ?? null, orgId).catch(() => {})
    }).catch(() => {})
  }).catch(() => {})

  // Fire-and-forget notifications
  import('@/lib/services/maintenanceNotificationService').then(({ notifyTicketSubmitted, notifyUrgentTicket }) => {
    notifyTicketSubmitted(ticket as unknown as TicketSnapshot, orgId).catch((err: unknown) =>
      log.error({ err: String(err) }, 'notifyTicketSubmitted failed')
    )
    if (data.priority === 'URGENT') {
      notifyUrgentTicket(ticket as unknown as TicketSnapshot, orgId).catch((err: unknown) =>
        log.error({ err: String(err) }, 'notifyUrgentTicket failed')
      )
    }
  }).catch((err: unknown) =>
    log.error({ err: String(err) }, 'notification import failed')
  )

  return ticket
}

// ─── Transition Status ────────────────────────────────────────────────────────

type TransitionData = {
  holdReason?: HoldReason
  holdNote?: string
  completionNote?: string
  completionPhotos?: string[]
  cancellationReason?: string
  rejectionNote?: string
  comment?: string
}

type UserContext = {
  userId: string
  organizationId: string
}

export async function transitionTicketStatus(
  ticketId: string,
  newStatus: MaintenanceTicketStatus,
  data: TransitionData,
  ctx: UserContext
) {
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    include: { submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
  })

  if (!ticket) throw new Error('TICKET_NOT_FOUND')

  // Cast PM fields for type safety (Prisma returns Json/unknown for scalar arrays in extended client)
  const pmChecklistItems = (ticket.pmChecklistItems ?? []) as string[]
  const pmChecklistDone = (ticket.pmChecklistDone ?? []) as boolean[]

  // Override ticket with typed PM fields for gate checks below
  Object.assign(ticket, { pmChecklistItems, pmChecklistDone })

  const currentStatus = ticket.status as MaintenanceTicketStatus
  const transitionConfig = ALLOWED_TRANSITIONS[currentStatus]?.[newStatus]

  if (!transitionConfig) {
    throw new Error(`INVALID_TRANSITION: ${currentStatus} -> ${newStatus}`)
  }

  // Check permissions
  const hasPermission = await canAny(ctx.userId, transitionConfig.requiredPermissions)
  if (!hasPermission) {
    throw new Error(`FORBIDDEN: Insufficient permissions for transition ${currentStatus} -> ${newStatus}`)
  }

  // Validate required fields
  if (transitionConfig.requiredFields) {
    for (const field of transitionConfig.requiredFields) {
      const val = (data as Record<string, unknown>)[field]
      const missing = val === undefined || val === null || val === '' ||
        (Array.isArray(val) && val.length === 0)
      if (missing) {
        throw new Error(`MISSING_FIELD: ${field} is required for this transition`)
      }
    }
  }

  // ── PM Checklist Gate: block QA transition if checklist incomplete ──────────
  if (newStatus === 'QA' && ticket.pmScheduleId) {
    const checklistItems = ticket.pmChecklistItems as string[]
    const checklistDone = ticket.pmChecklistDone as boolean[]
    if (checklistItems.length > 0 && !checklistDone.every(Boolean)) {
      throw new Error('CHECKLIST_INCOMPLETE: Complete all PM checklist items before moving to QA')
    }
  }

  // Build update payload
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'ON_HOLD') {
    updateData.holdReason = data.holdReason
    updateData.holdNote = data.holdNote ?? null
  }

  if (newStatus === 'QA') {
    updateData.completionNote = data.completionNote
    updateData.completionPhotos = data.completionPhotos ?? []
  }

  if (newStatus === 'CANCELLED') {
    updateData.cancellationReason = data.cancellationReason
  }

  // Increment version for optimistic concurrency
  updateData.version = { increment: 1 }

  const updated = await prisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: TICKET_INCLUDES,
  })

  // ── PM Next-Due-Date Recalculation on DONE ───────────────────────────────
  if (newStatus === 'DONE' && ticket.pmScheduleId) {
    try {
      // Lazy import to avoid circular dep — pmScheduleService imports maintenanceTicketService
      const { computeNextDueDate } = await import('@/lib/services/pmScheduleService')
      const pmSchedule = await rawPrisma.pmSchedule.findUnique({
        where: { id: ticket.pmScheduleId },
      })
      if (pmSchedule) {
        const completionDate = startOfDay(new Date())
        const nextDueDate = computeNextDueDate(
          completionDate,
          pmSchedule.recurrenceType as PmRecurrenceType,
          pmSchedule.intervalDays,
          pmSchedule.months as number[]
        )
        await rawPrisma.pmSchedule.update({
          where: { id: pmSchedule.id },
          data: {
            nextDueDate,
            lastCompletedDate: completionDate,
          },
        })
        log.info(
          { pmScheduleId: pmSchedule.id, nextDueDate: nextDueDate.toISOString() },
          'PM schedule next due date updated',
        )
      }
    } catch (pmErr) {
      log.error({ err: String(pmErr) }, 'Failed to update PM schedule next-due-date')
    }
  }

  // Log activity
  const activityContent =
    newStatus === 'IN_PROGRESS' && currentStatus === 'QA' && data.rejectionNote
      ? `QA rejected: ${data.rejectionNote}`
      : data.comment ?? transitionConfig.description

  await rawPrisma.maintenanceTicketActivity.create({
    data: {
      organizationId: ctx.organizationId,
      ticketId,
      actorId: ctx.userId,
      type: 'STATUS_CHANGE',
      fromStatus: currentStatus,
      toStatus: newStatus,
      content: activityContent,
    },
  })

  // Phase 29: Post bot message on maintenance status change
  import('@/lib/services/systemBotService').then(({ postMaintenanceAlert }) => {
    prisma.team.findFirst({
      where: { organizationId: ctx.organizationId, slug: 'maintenance' },
      select: { id: true },
    }).then((maintenanceTeam) => {
      postMaintenanceAlert(ticketId, ticket.title, maintenanceTeam?.id ?? null, ctx.organizationId).catch(() => {})
    }).catch(() => {})
  }).catch(() => {})

  // Fire-and-forget notifications
  import('@/lib/services/maintenanceNotificationService').then(({ notifyStatusChange, notifyQARejected }) => {
    notifyStatusChange(updated as unknown as TicketSnapshot, newStatus, ctx.organizationId).catch((err: unknown) =>
      log.error({ err: String(err) }, 'notifyStatusChange failed')
    )
    if (currentStatus === 'QA' && newStatus === 'IN_PROGRESS' && data.rejectionNote) {
      notifyQARejected(updated as unknown as TicketSnapshot, data.rejectionNote, ctx.organizationId).catch((err: unknown) =>
        log.error({ err: String(err) }, 'notifyQARejected failed')
      )
    }
  }).catch((err: unknown) =>
    log.error({ err: String(err) }, 'notification import failed')
  )

  return updated
}

// ─── Claim Ticket ─────────────────────────────────────────────────────────────

export async function claimTicket(ticketId: string, userId: string, orgId: string) {
  await assertCan(userId, PERMISSIONS.MAINTENANCE_CLAIM)

  // Load technician profile
  const profile = await rawPrisma.technicianProfile.findUnique({
    where: { userId },
  })
  if (!profile) {
    throw new Error('TECHNICIAN_PROFILE_NOT_FOUND')
  }

  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    include: TICKET_INCLUDES,
  })
  if (!ticket) throw new Error('TICKET_NOT_FOUND')

  // Specialty check — OTHER specialty always matches
  const ticketSpecialty = ticket.specialty as MaintenanceSpecialty
  const techSpecialties = profile.specialties as MaintenanceSpecialty[]
  if (ticketSpecialty !== 'OTHER' && !techSpecialties.includes(ticketSpecialty)) {
    throw new Error('SPECIALTY_MISMATCH')
  }

  const newStatus: MaintenanceTicketStatus =
    ticket.status === 'BACKLOG' ? 'TODO' : ticket.status as MaintenanceTicketStatus

  const updated = await prisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: {
      assignedToId: userId,
      status: newStatus,
      version: { increment: 1 },
    },
    include: TICKET_INCLUDES,
  })

  await rawPrisma.maintenanceTicketActivity.create({
    data: {
      organizationId: orgId,
      ticketId,
      actorId: userId,
      type: 'ASSIGNMENT',
      fromStatus: ticket.status as MaintenanceTicketStatus,
      toStatus: newStatus,
      assignedToId: userId,
      content: 'Ticket claimed by technician',
    },
  })

  // Fire-and-forget
  import('@/lib/services/maintenanceNotificationService').then(({ notifyTicketClaimed }) => {
    notifyTicketClaimed(updated as unknown as TicketSnapshot, orgId).catch((err: unknown) =>
      log.error({ err: String(err) }, 'notifyTicketClaimed failed')
    )
  }).catch((err: unknown) =>
    log.error({ err: String(err) }, 'notification import failed')
  )

  return updated
}

// ─── Assign Ticket ────────────────────────────────────────────────────────────

export async function assignTicket(
  ticketId: string,
  assigneeId: string,
  userId: string,
  orgId: string
) {
  // No specialty check — head can assign any ticket to any tech (ROUTE-03)
  await assertCan(userId, PERMISSIONS.MAINTENANCE_ASSIGN)

  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    include: TICKET_INCLUDES,
  })
  if (!ticket) throw new Error('TICKET_NOT_FOUND')

  const newStatus: MaintenanceTicketStatus =
    ticket.status === 'BACKLOG' ? 'TODO' : ticket.status as MaintenanceTicketStatus
  const isReassignment = !!ticket.assignedToId && ticket.assignedToId !== assigneeId

  const updateData: Record<string, unknown> = {
    assignedToId: assigneeId,
    status: newStatus,
    version: { increment: 1 },
  }
  // Set firstResponseAt on first assignment (SLA response tracking)
  if (!ticket.firstResponseAt) {
    updateData.firstResponseAt = new Date()
  }

  const updated = await prisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: TICKET_INCLUDES,
  })

  await rawPrisma.maintenanceTicketActivity.create({
    data: {
      organizationId: orgId,
      ticketId,
      actorId: userId,
      type: isReassignment ? 'REASSIGNMENT' : 'ASSIGNMENT',
      fromStatus: ticket.status as MaintenanceTicketStatus,
      toStatus: newStatus,
      assignedToId: assigneeId,
      content: isReassignment ? 'Ticket reassigned' : 'Ticket assigned',
    },
  })

  // Auto-add assignee as watcher
  await rawPrisma.maintenanceTicketWatcher.upsert({
    where: { ticketId_userId: { ticketId, userId: assigneeId } },
    create: { organizationId: orgId, ticketId, userId: assigneeId },
    update: {},
  }).catch(() => {})

  // Fire-and-forget
  import('@/lib/services/maintenanceNotificationService').then(({ notifyTicketAssigned }) => {
    notifyTicketAssigned(updated as unknown as TicketSnapshot, assigneeId, orgId).catch((err: unknown) =>
      log.error({ err: String(err) }, 'notifyTicketAssigned failed')
    )
  }).catch((err: unknown) =>
    log.error({ err: String(err) }, 'notification import failed')
  )

  return updated
}

// Query functions (getTicketDetail, listTickets) are in maintenanceTicketQueries.ts
// and re-exported from this file for backward compatibility.
