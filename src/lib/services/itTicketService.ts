/**
 * IT Help Desk Ticket Service
 *
 * Core business logic for the IT ticket lifecycle:
 * - Ticket creation with auto-generated IT-XXXX numbers
 * - 6-status state machine with validated transitions
 * - Role-scoped ticket listing (submitter sees own, IT coordinator sees all)
 * - Activity logging for every state change, comment, and assignment
 */

import { z } from 'zod'
import { rawPrisma, prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { canAny } from '@/lib/auth/permissions'
import type {
  ITTicketStatus,
  ITIssueType,
  ITPriority,
  ITHoldReason,
  ITPasswordSubType,
  ITAVSubType,
} from '@prisma/client'

// ─── Transition Map ───────────────────────────────────────────────────────────

type TransitionConfig = {
  requiredPermissions: string[]
  requiredFields?: string[]
  description: string
}

export const ALLOWED_TRANSITIONS: Record<
  ITTicketStatus,
  Partial<Record<ITTicketStatus, TransitionConfig>>
> = {
  BACKLOG: {
    TODO: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS, PERMISSIONS.IT_TICKET_ASSIGN],
      description: 'Claim or assign ticket',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  TODO: {
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      description: 'Begin working on ticket',
    },
    ON_HOLD: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['holdReason'],
      description: 'Place ticket on hold',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  IN_PROGRESS: {
    DONE: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['resolutionNote'],
      description: 'Mark resolved with resolution note',
    },
    ON_HOLD: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['holdReason'],
      description: 'Place ticket on hold',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  ON_HOLD: {
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      description: 'Resume work on ticket',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.IT_TICKET_UPDATE_STATUS],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  DONE: {}, // Terminal
  CANCELLED: {}, // Terminal
}

/**
 * Check if a board drag-and-drop transition is allowed
 */
export function isBoardTransitionAllowed(from: ITTicketStatus, to: ITTicketStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from]
  return !!allowed && to in allowed
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const CreateITTicketSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  issueType: z.enum(['HARDWARE', 'SOFTWARE', 'ACCOUNT_PASSWORD', 'NETWORK', 'DISPLAY_AV', 'OTHER']),
  passwordSubType: z.enum(['RESET', 'LOCKED', 'NEW_ACCOUNT', 'PERMISSION_CHANGE']).optional(),
  avSubType: z.enum(['PROJECTOR', 'SOUNDBOARD', 'DISPLAY', 'APPLE_TV', 'OTHER_AV']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  photos: z.array(z.string()).max(3).default([]),
  buildingId: z.string().optional(),
  areaId: z.string().optional(),
  roomId: z.string().optional(),
  schoolId: z.string().optional(),
})

export const SubTicketSchema = z.object({
  roomText: z.string().min(1, 'Room number is required'),
  issueType: z.enum(['HARDWARE', 'SOFTWARE', 'ACCOUNT_PASSWORD', 'NETWORK', 'DISPLAY_AV', 'OTHER']),
  description: z.string().min(1, 'Description is required'),
})

// ─── Ticket Number Generator ─────────────────────────────────────────────────

export async function generateITTicketNumber(orgId: string): Promise<string> {
  const counter = await rawPrisma.iTTicketCounter.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, lastTicketNumber: 1 },
    update: { lastTicketNumber: { increment: 1 } },
  })
  return `IT-${String(counter.lastTicketNumber).padStart(4, '0')}`
}

// ─── Create Ticket ───────────────────────────────────────────────────────────

export async function createITTicket(
  input: z.infer<typeof CreateITTicketSchema>,
  userId: string,
  orgId: string
) {
  const ticketNumber = await generateITTicketNumber(orgId)

  const ticket = await prisma.iTTicket.create({
    data: {
      ticketNumber,
      title: input.title,
      description: input.description,
      issueType: input.issueType as ITIssueType,
      passwordSubType: input.passwordSubType as ITPasswordSubType | undefined,
      avSubType: input.avSubType as ITAVSubType | undefined,
      priority: input.priority as ITPriority,
      photos: input.photos,
      source: 'AUTHENTICATED',
      buildingId: input.buildingId,
      areaId: input.areaId,
      roomId: input.roomId,
      schoolId: input.schoolId,
      submittedById: userId,
      status: 'BACKLOG',
    },
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  // Log creation activity
  await prisma.iTTicketActivity.create({
    data: {
      ticketId: ticket.id,
      actorId: userId,
      type: 'STATUS_CHANGE',
      toStatus: 'BACKLOG',
      content: 'Ticket submitted',
    },
  })

  return ticket
}

// ─── Create Sub Ticket (Magic Link) ─────────────────────────────────────────

export async function createSubTicket(
  input: z.infer<typeof SubTicketSchema>,
  orgId: string,
  schoolId?: string
) {
  const ticketNumber = await generateITTicketNumber(orgId)

  const ticket = await prisma.iTTicket.create({
    data: {
      ticketNumber,
      title: `${input.issueType.replace(/_/g, ' ')} Issue — ${input.roomText}`,
      description: input.description,
      issueType: input.issueType as ITIssueType,
      priority: 'MEDIUM',
      source: 'SUB_SUBMITTED',
      subRoomText: input.roomText,
      subDate: new Date(),
      schoolId: schoolId || undefined,
      status: 'BACKLOG',
    },
  })

  // Log creation activity (no actor — system generated)
  await prisma.iTTicketActivity.create({
    data: {
      ticketId: ticket.id,
      type: 'STATUS_CHANGE',
      toStatus: 'BACKLOG',
      content: `Submitted via magic link — Room ${input.roomText}`,
    },
  })

  return ticket
}

// ─── Transition Status ───────────────────────────────────────────────────────

export async function transitionITTicketStatus(
  ticketId: string,
  newStatus: ITTicketStatus,
  data: {
    holdReason?: ITHoldReason
    holdNote?: string
    resolutionNote?: string
    cancellationReason?: string
    comment?: string
  },
  ctx: { userId: string; orgId: string }
) {
  const ticket = await prisma.iTTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new Error('TICKET_NOT_FOUND')

  const transitions = ALLOWED_TRANSITIONS[ticket.status]
  const config = transitions?.[newStatus]
  if (!config) throw new Error(`INVALID_TRANSITION: ${ticket.status} → ${newStatus}`)

  // Check permissions
  const hasPerm = await canAny(ctx.userId, config.requiredPermissions)
  if (!hasPerm) throw new Error('Insufficient permissions')

  // Validate required fields
  if (config.requiredFields) {
    for (const field of config.requiredFields) {
      if (!data[field as keyof typeof data]) {
        throw new Error(`MISSING_FIELD: ${field} is required for ${ticket.status} → ${newStatus}`)
      }
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'ON_HOLD') {
    updateData.holdReason = data.holdReason
    updateData.holdNote = data.holdNote || null
  }
  if (newStatus === 'DONE') {
    updateData.resolutionNote = data.resolutionNote
    // Clear hold fields
    updateData.holdReason = null
    updateData.holdNote = null
  }
  if (newStatus === 'CANCELLED') {
    updateData.cancellationReason = data.cancellationReason
  }
  if (newStatus === 'IN_PROGRESS' && ticket.status === 'ON_HOLD') {
    // Resuming from hold — clear hold fields
    updateData.holdReason = null
    updateData.holdNote = null
  }

  const updated = await prisma.iTTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  // Log activity
  await prisma.iTTicketActivity.create({
    data: {
      ticketId,
      actorId: ctx.userId,
      type: 'STATUS_CHANGE',
      fromStatus: ticket.status,
      toStatus: newStatus,
      content: data.comment || `Status changed from ${ticket.status} to ${newStatus}`,
    },
  })

  return updated
}

// ─── Assign Ticket ───────────────────────────────────────────────────────────

export async function assignITTicket(
  ticketId: string,
  assigneeId: string,
  ctx: { userId: string; orgId: string }
) {
  const ticket = await prisma.iTTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new Error('TICKET_NOT_FOUND')

  // Move to TODO if in BACKLOG
  const updateData: Record<string, unknown> = { assignedToId: assigneeId }
  if (ticket.status === 'BACKLOG') {
    updateData.status = 'TODO'
  }

  const updated = await prisma.iTTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  // Log assignment
  await prisma.iTTicketActivity.create({
    data: {
      ticketId,
      actorId: ctx.userId,
      type: 'ASSIGNMENT',
      assignedToId: assigneeId,
      content: ctx.userId === assigneeId ? 'Claimed ticket' : 'Ticket assigned',
      ...(ticket.status === 'BACKLOG' ? { fromStatus: 'BACKLOG', toStatus: 'TODO' } : {}),
    },
  })

  return updated
}

// ─── List Tickets (Role-Scoped) ──────────────────────────────────────────────

interface ListITTicketsInput {
  status?: ITTicketStatus
  issueType?: ITIssueType
  priority?: ITPriority
  assignedToId?: string
  schoolId?: string
  search?: string
  unassigned?: boolean
  excludeStatus?: ITTicketStatus[]
  limit?: number
  offset?: number
}

export async function listITTickets(
  filters: ListITTicketsInput,
  ctx: { userId: string; orgId: string }
) {
  const canReadAll = await canAny(ctx.userId, [PERMISSIONS.IT_TICKET_READ_ALL])

  const where: Record<string, unknown> = {}

  // Role scoping
  if (!canReadAll) {
    where.submittedById = ctx.userId
  }

  // Filters
  if (filters.status) where.status = filters.status
  if (filters.issueType) where.issueType = filters.issueType
  if (filters.priority) where.priority = filters.priority
  if (filters.assignedToId) where.assignedToId = filters.assignedToId
  if (filters.schoolId) where.schoolId = filters.schoolId
  if (filters.unassigned) where.assignedToId = null
  if (filters.excludeStatus?.length) {
    where.status = { notIn: filters.excludeStatus }
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { ticketNumber: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [tickets, total] = await Promise.all([
    prisma.iTTicket.findMany({
      where,
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        building: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true, displayName: true } },
        school: { select: { id: true, name: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.iTTicket.count({ where }),
  ])

  return { tickets, total }
}

// ─── Get Ticket Detail ───────────────────────────────────────────────────────

export async function getITTicketDetail(ticketId: string) {
  const ticket = await prisma.iTTicket.findUnique({
    where: { id: ticketId },
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      building: { select: { id: true, name: true } },
      area: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
      school: { select: { id: true, name: true } },
      activities: {
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return ticket
}

// ─── Get Board Data ──────────────────────────────────────────────────────────

export async function getITBoardData(ctx: { userId: string; orgId: string }, schoolId?: string) {
  const canReadAll = await canAny(ctx.userId, [PERMISSIONS.IT_TICKET_READ_ALL])

  const where: Record<string, unknown> = {}
  if (!canReadAll) {
    where.OR = [
      { submittedById: ctx.userId },
      { assignedToId: ctx.userId },
    ]
  }
  if (schoolId) where.schoolId = schoolId

  // Exclude terminal states from board
  where.status = { notIn: ['DONE', 'CANCELLED'] as ITTicketStatus[] }

  const tickets = await prisma.iTTicket.findMany({
    where,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
      school: { select: { id: true, name: true } },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })

  // Group by status
  const columns: Record<string, typeof tickets> = {
    BACKLOG: [],
    TODO: [],
    IN_PROGRESS: [],
    ON_HOLD: [],
    DONE: [],
    CANCELLED: [],
  }

  for (const ticket of tickets) {
    columns[ticket.status]?.push(ticket)
  }

  return columns
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getITDashboardStats(ctx: { userId: string; orgId: string }, schoolId?: string) {
  const where: Record<string, unknown> = {}
  if (schoolId) where.schoolId = schoolId

  const [total, open, inProgress, urgent, recentDone] = await Promise.all([
    prisma.iTTicket.count({ where }),
    prisma.iTTicket.count({ where: { ...where, status: { in: ['BACKLOG', 'TODO'] } } }),
    prisma.iTTicket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.iTTicket.count({ where: { ...where, priority: 'URGENT', status: { notIn: ['DONE', 'CANCELLED'] } } }),
    prisma.iTTicket.count({
      where: {
        ...where,
        status: 'DONE',
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  return { total, open, inProgress, urgent, recentDone }
}

// ─── Add Comment ─────────────────────────────────────────────────────────────

export async function addITTicketComment(
  ticketId: string,
  content: string,
  isInternal: boolean,
  ctx: { userId: string }
) {
  const activity = await prisma.iTTicketActivity.create({
    data: {
      ticketId,
      actorId: ctx.userId,
      type: isInternal ? 'INTERNAL_NOTE' : 'COMMENT',
      content,
      isInternal,
    },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
  })

  return activity
}
