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
import { rawPrisma, prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { assertCan, canAny } from '@/lib/auth/permissions'
import { startOfDay } from 'date-fns'
import type {
  MaintenanceTicketStatus,
  MaintenanceCategory,
  MaintenanceSpecialty,
  MaintenancePriority,
  HoldReason,
} from '@prisma/client'

// ─── Category → Specialty Map ─────────────────────────────────────────────────

export const CATEGORY_TO_SPECIALTY: Record<MaintenanceCategory, MaintenanceSpecialty> = {
  ELECTRICAL: 'ELECTRICAL',
  PLUMBING: 'PLUMBING',
  HVAC: 'HVAC',
  STRUCTURAL: 'STRUCTURAL',
  CUSTODIAL_BIOHAZARD: 'CUSTODIAL_BIOHAZARD',
  IT_AV: 'IT_AV',
  GROUNDS: 'GROUNDS',
  OTHER: 'OTHER',
}

// ─── Transition Map ───────────────────────────────────────────────────────────

type TransitionConfig = {
  requiredPermissions: string[]
  requiredFields?: string[]
  description: string
}

export const ALLOWED_TRANSITIONS: Record<
  MaintenanceTicketStatus,
  Partial<Record<MaintenanceTicketStatus, TransitionConfig>>
> = {
  BACKLOG: {
    TODO: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Claim or assign ticket to start work',
    },
    SCHEDULED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Schedule ticket for a future date',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  TODO: {
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Begin working on ticket',
    },
    ON_HOLD: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      requiredFields: ['holdReason'],
      description: 'Place ticket on hold with reason',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  IN_PROGRESS: {
    QA: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      requiredFields: ['completionNote', 'completionPhotos'],
      description: 'Submit for QA review with completion evidence',
    },
    ON_HOLD: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      requiredFields: ['holdReason'],
      description: 'Place ticket on hold with reason',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  ON_HOLD: {
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Resume work on ticket',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  QA: {
    DONE: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA],
      description: 'Approve QA and close ticket',
    },
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA],
      requiredFields: ['rejectionNote'],
      description: 'Reject QA and send back to work',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  SCHEDULED: {
    BACKLOG: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Release scheduled ticket to backlog (system/cron)',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  DONE: {},
  CANCELLED: {},
}

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
  areaId: z.string().optional(),
  roomId: z.string().optional(),
  schoolId: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  availabilityNote: z.string().optional(),
  assetId: z.string().optional(),  // Optional link to a MaintenanceAsset
})

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>

// ─── Ticket Includes ──────────────────────────────────────────────────────────

const TICKET_INCLUDES = {
  submittedBy: {
    select: { id: true, firstName: true, lastName: true, email: true, userRole: { select: { name: true } } },
  },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  building: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  room: { select: { id: true, roomNumber: true, displayName: true } },
  school: { select: { id: true, name: true } },
  asset: {
    select: {
      repeatAlertSentAt: true,
      costAlertSentAt: true,
      eolAlertSentAt: true,
    },
  },
} as const

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
      areaId: data.areaId,
      roomId: data.roomId,
      schoolId: data.schoolId,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      availabilityNote: data.availabilityNote,
      assetId: data.assetId ?? null,
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

  // Auto-add submitter as watcher
  await rawPrisma.maintenanceTicketWatcher.create({
    data: {
      organizationId: orgId,
      ticketId: ticket.id,
      userId,
    },
  }).catch(() => {}) // Ignore if already exists

  // Fire-and-forget notifications
  import('@/lib/services/maintenanceNotificationService').then(({ notifyTicketSubmitted, notifyUrgentTicket }) => {
    notifyTicketSubmitted(ticket as any, orgId).catch((err: unknown) =>
      console.error('[MaintenanceNotify] notifyTicketSubmitted failed:', err)
    )
    if (data.priority === 'URGENT') {
      notifyUrgentTicket(ticket as any, orgId).catch((err: unknown) =>
        console.error('[MaintenanceNotify] notifyUrgentTicket failed:', err)
      )
    }
  }).catch((err: unknown) =>
    console.error('[MaintenanceNotify] import failed:', err)
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
    data: updateData as any,
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
          pmSchedule.recurrenceType as any,
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
        console.log(
          `[maintenanceTicketService] PM schedule ${pmSchedule.id} next due date updated to ${nextDueDate.toISOString()}`
        )
      }
    } catch (pmErr) {
      console.error('[maintenanceTicketService] Failed to update PM schedule next-due-date:', pmErr)
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

  // Fire-and-forget notifications
  import('@/lib/services/maintenanceNotificationService').then(({ notifyStatusChange, notifyQARejected }) => {
    notifyStatusChange(updated as any, newStatus, ctx.organizationId).catch((err: unknown) =>
      console.error('[MaintenanceNotify] notifyStatusChange failed:', err)
    )
    if (currentStatus === 'QA' && newStatus === 'IN_PROGRESS' && data.rejectionNote) {
      notifyQARejected(updated as any, data.rejectionNote, ctx.organizationId).catch((err: unknown) =>
        console.error('[MaintenanceNotify] notifyQARejected failed:', err)
      )
    }
  }).catch((err: unknown) =>
    console.error('[MaintenanceNotify] import failed:', err)
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
    notifyTicketClaimed(updated as any, orgId).catch((err: unknown) =>
      console.error('[MaintenanceNotify] notifyTicketClaimed failed:', err)
    )
  }).catch((err: unknown) =>
    console.error('[MaintenanceNotify] import failed:', err)
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

  const updated = await prisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: {
      assignedToId: assigneeId,
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
    notifyTicketAssigned(updated as any, assigneeId, orgId).catch((err: unknown) =>
      console.error('[MaintenanceNotify] notifyTicketAssigned failed:', err)
    )
  }).catch((err: unknown) =>
    console.error('[MaintenanceNotify] import failed:', err)
  )

  return updated
}

// ─── Get Ticket Detail ────────────────────────────────────────────────────────

export async function getTicketDetail(ticketId: string, userId: string) {
  const canReadAll = await canAny(userId, [
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.MAINTENANCE_CLAIM,
  ])

  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    include: {
      ...TICKET_INCLUDES,
      activities: {
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      watchers: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  })

  if (!ticket) return null

  // Filter internal activities for users without broad access
  const filteredActivities = canReadAll
    ? ticket.activities
    : ticket.activities.filter((a) => !a.isInternal)

  return { ...ticket, activities: filteredActivities }
}

// ─── List Tickets ─────────────────────────────────────────────────────────────

type ListFilters = {
  status?: MaintenanceTicketStatus
  priority?: MaintenancePriority
  category?: MaintenanceCategory
  schoolId?: string
  assignedToId?: string
  search?: string
  unassigned?: boolean
  excludeStatus?: MaintenanceTicketStatus
}

export async function listTickets(filters: ListFilters, ctx: UserContext) {
  const hasReadAll = await canAny(ctx.userId, [PERMISSIONS.MAINTENANCE_READ_ALL])
  const hasClaim = await canAny(ctx.userId, [PERMISSIONS.MAINTENANCE_CLAIM])

  const where: Record<string, unknown> = {}

  // Role-scoped filtering
  if (hasReadAll) {
    // Head/admin sees everything
  } else if (hasClaim) {
    // Technician sees unassigned + own assigned
    where.OR = [
      { assignedToId: null },
      { assignedToId: ctx.userId },
    ]
  } else {
    // Submitter sees own tickets only
    where.submittedById = ctx.userId
  }

  // Apply filters
  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.category) where.category = filters.category
  if (filters.schoolId) where.schoolId = filters.schoolId
  if (filters.assignedToId !== undefined) where.assignedToId = filters.assignedToId
  if (filters.unassigned) where.assignedToId = null
  if (filters.excludeStatus) {
    where.NOT = { status: filters.excludeStatus }
  }
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' }
  }

  const tickets = await prisma.maintenanceTicket.findMany({
    where: where as any,
    include: {
      ...TICKET_INCLUDES,
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })

  // For technicians, add matchesSpecialty flag
  if (hasClaim && !hasReadAll) {
    const profile = await rawPrisma.technicianProfile.findUnique({
      where: { userId: ctx.userId },
    })
    const techSpecialties = (profile?.specialties ?? []) as MaintenanceSpecialty[]

    return tickets.map((t) => ({
      ...t,
      matchesSpecialty:
        (t.specialty as MaintenanceSpecialty) === 'OTHER' ||
        techSpecialties.includes(t.specialty as MaintenanceSpecialty),
    }))
  }

  return tickets
}
