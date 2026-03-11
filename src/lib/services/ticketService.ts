import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Ticket, TicketStatus, TicketSource } from '@prisma/client'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { stripAllHtml } from '@/lib/sanitize'

// ============= Validation Schemas =============

export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).transform(stripAllHtml),
  description: z.string().transform(stripAllHtml).optional().nullable(),
  category: z.enum(['MAINTENANCE', 'IT', 'EVENT']).default('MAINTENANCE'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  source: z.enum(['MANUAL', 'SHADOW_EVENT_AUTOMATION']).default('MANUAL'),
  schoolId: z.string().optional().nullable(),
  locationRefType: z.enum(['ROOM', 'AREA', 'BUILDING', 'FREE_TEXT']).optional().nullable(),
  locationRefId: z.string().optional().nullable(),
  locationText: z.string().trim().min(1).max(300).transform(stripAllHtml).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const hasRefType = !!data.locationRefType
  const hasRefId = !!data.locationRefId
  const hasLocationText = !!data.locationText

  if ((hasRefType && !hasRefId) || (!hasRefType && hasRefId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'locationRefType and locationRefId must be provided together',
      path: hasRefType ? ['locationRefId'] : ['locationRefType'],
    })
  }

  if (!hasRefType && !hasRefId && !hasLocationText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either a structured location reference or locationText',
      path: ['locationText'],
    })
  }
})

export const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(200).transform(stripAllHtml).optional(),
  description: z.string().transform(stripAllHtml).optional().nullable(),
  category: z.enum(['MAINTENANCE', 'IT', 'EVENT']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  schoolId: z.string().optional().nullable(),
  locationRefType: z.enum(['ROOM', 'AREA', 'BUILDING', 'FREE_TEXT']).optional().nullable(),
  locationRefId: z.string().optional().nullable(),
  locationText: z.string().trim().min(1).max(300).transform(stripAllHtml).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const refTypeProvided = data.locationRefType !== undefined
  const refIdProvided = data.locationRefId !== undefined

  if (refTypeProvided !== refIdProvided) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'locationRefType and locationRefId must be updated together',
      path: refTypeProvided ? ['locationRefId'] : ['locationRefType'],
    })
  }
})

export const ListTicketsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  skip: z.number().int().min(0).default(0),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  category: z.enum(['MAINTENANCE', 'IT', 'EVENT']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  assignedToId: z.string().optional(),
  schoolId: z.string().optional(),
  search: z.string().max(200).optional(),
})

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>
export type ListTicketsInput = z.infer<typeof ListTicketsSchema>

// ============= Service Functions =============

/**
 * List tickets with pagination and filtering
 * Users with tickets:read_all can see all tickets, others only see their assigned tickets
 * @param input Query parameters
 * @param userId User ID for filtering
 */
export async function listTickets(
  input: Partial<ListTicketsInput>,
  userId: string
): Promise<Ticket[]> {
  const validated = ListTicketsSchema.parse(input)

  const where: any = {}
  if (validated.status) {
    where.status = validated.status
  }
  if (validated.category) {
    where.category = validated.category
  }
  if (validated.priority) {
    where.priority = validated.priority
  }
  if (validated.assignedToId) {
    where.assignedToId = validated.assignedToId
  }
  if (validated.schoolId) {
    where.schoolId = validated.schoolId
  }

  // Keyword search across title and description
  // IMPORTANT: The AND wrapper is intentional — where.OR is used for access-control
  // filtering below and must NOT be overwritten. The search OR must be nested inside
  // AND to compose correctly with the access-control OR clause.
  if (validated.search) {
    const s = validated.search.trim()
    if (s) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
          ],
        },
      ]
    }
  }

  // Check if user can see all tickets, otherwise only show own (created or assigned)
  const canReadAll = await can(userId, PERMISSIONS.TICKETS_READ_ALL)
  if (!canReadAll) {
    where.OR = [
      { assignedToId: userId },
      { createdById: userId },
    ]
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: validated.limit,
    skip: validated.skip,
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return tickets
}

/**
 * Count tickets matching the given filters (for pagination metadata)
 * Mirrors the access-control logic of listTickets.
 */
export async function countTickets(
  input: Partial<ListTicketsInput>,
  userId: string
): Promise<number> {
  const validated = ListTicketsSchema.parse(input)

  const where: any = {}
  if (validated.status) where.status = validated.status
  if (validated.category) where.category = validated.category
  if (validated.priority) where.priority = validated.priority
  if (validated.assignedToId) where.assignedToId = validated.assignedToId
  if (validated.schoolId) where.schoolId = validated.schoolId

  if (validated.search) {
    const s = validated.search.trim()
    if (s) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
          ],
        },
      ]
    }
  }

  const canReadAll = await can(userId, PERMISSIONS.TICKETS_READ_ALL)
  if (!canReadAll) {
    where.OR = [
      { assignedToId: userId },
      { createdById: userId },
    ]
  }

  return prisma.ticket.count({ where })
}

/**
 * Get single ticket by ID
 * @param id Ticket ID
 * @param userId User ID for access check
 */
export async function getTicketById(
  id: string,
  userId: string
): Promise<Ticket | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
  })

  if (!ticket) return null

  // Check if user can view all tickets, or is the assignee, or is the creator
  const canReadAll = await can(userId, PERMISSIONS.TICKETS_READ_ALL)
  if (!canReadAll && ticket.assignedToId !== userId && ticket.createdById !== userId) {
    throw new Error('Access denied: You can only view tickets assigned to or created by you')
  }

  return ticket
}

/**
 * Create a new ticket
 * Requires tickets:create permission (or automated system)
 * @param input Ticket data
 * @param userId User ID for permission check (null for automated creation)
 */
export async function createTicket(
  input: CreateTicketInput,
  userId: string | null = null
): Promise<Ticket> {
  // Permission check: Only required for manual creation
  if (input.source === 'MANUAL' && userId) {
    await assertCan(userId, PERMISSIONS.TICKETS_CREATE)
  }

  const validated = CreateTicketSchema.parse(input)

  const ticket = await prisma.ticket.create({
    data: {
      title: validated.title,
      description: validated.description,
      category: validated.category,
      priority: validated.priority,
      source: validated.source,
      schoolId: validated.schoolId ?? null,
      locationRefType: validated.locationRefType,
      locationRefId: validated.locationRefId,
      locationText: validated.locationText,
      status: 'OPEN',
      assignedToId: validated.assignedToId,
      createdById: userId,
    } as any, // Temp workaround for org-scoped extension typing
  })

  return ticket
}

/**
 * Update an existing ticket
 * tickets:update_all allows updating any ticket, tickets:update_own allows status updates on assigned tickets
 * @param id Ticket ID
 * @param input Updated ticket data
 * @param userId User ID for access check
 */
export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  userId: string
): Promise<Ticket> {
  // Check access
  const existing = await prisma.ticket.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Ticket not found')
  }

  const canUpdateAll = await can(userId, PERMISSIONS.TICKETS_UPDATE_ALL)
  const canUpdateOwn = await can(userId, PERMISSIONS.TICKETS_UPDATE_OWN)
  const isAssignee = existing.assignedToId === userId

  if (!canUpdateAll && !(canUpdateOwn && isAssignee)) {
    throw new Error('Access denied: You can only update tickets assigned to you')
  }

  const validated = UpdateTicketSchema.parse(input)

  // Users with tickets:update_own can only update status
  if (
    !canUpdateAll &&
    (
      validated.title !== undefined ||
      validated.description !== undefined ||
      validated.assignedToId !== undefined ||
      validated.category !== undefined ||
      validated.priority !== undefined ||
      validated.locationRefType !== undefined ||
      validated.locationRefId !== undefined ||
      validated.locationText !== undefined
    )
  ) {
    throw new Error('Insufficient permissions to update ticket details')
  }

  const updateData: any = {}
  if (validated.title !== undefined) updateData.title = validated.title
  if (validated.description !== undefined) updateData.description = validated.description
  if (validated.category !== undefined) updateData.category = validated.category
  if (validated.priority !== undefined) updateData.priority = validated.priority
  if (validated.status !== undefined) updateData.status = validated.status
  if (validated.locationRefType !== undefined) updateData.locationRefType = validated.locationRefType
  if (validated.locationRefId !== undefined) updateData.locationRefId = validated.locationRefId
  if (validated.locationText !== undefined) updateData.locationText = validated.locationText
  if (validated.assignedToId !== undefined) updateData.assignedToId = validated.assignedToId
  if (validated.schoolId !== undefined) updateData.schoolId = validated.schoolId

  const ticket = await prisma.ticket.update({
    where: { id },
    data: updateData,
  })

  return ticket
}

/**
 * Assign a ticket to a user
 * Requires tickets:assign permission
 * @param id Ticket ID
 * @param assignedToId User ID to assign to (null to unassign)
 * @param userId User ID for permission check
 */
export async function assignTicket(
  id: string,
  assignedToId: string | null,
  userId: string
): Promise<Ticket> {
  await assertCan(userId, PERMISSIONS.TICKETS_ASSIGN)

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { assignedToId },
  })

  return ticket
}

/**
 * Delete a ticket permanently
 * Requires tickets:delete permission
 * @param id Ticket ID
 * @param userId User ID for permission check
 */
export async function deleteTicket(id: string, userId: string): Promise<void> {
  await assertCan(userId, PERMISSIONS.TICKETS_DELETE)

  await prisma.ticket.delete({
    where: { id },
  })
}

/**
 * Bulk create tickets (for automation)
 * Internal use only - bypasses role checks
 * @param tickets Array of ticket data
 */
export async function bulkCreateTickets(
  tickets: CreateTicketInput[]
): Promise<Ticket[]> {
  const validated = tickets.map((t) => CreateTicketSchema.parse(t))

  const created = await Promise.all(
    validated.map((data) =>
      prisma.ticket.create({
        data: {
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority,
          source: data.source,
          locationRefType: data.locationRefType,
          locationRefId: data.locationRefId,
          locationText: data.locationText,
          status: 'OPEN',
          assignedToId: data.assignedToId,
        } as any,
      })
    )
  )

  return created
}

