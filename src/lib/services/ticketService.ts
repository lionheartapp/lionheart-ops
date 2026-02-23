import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Ticket, TicketStatus, TicketSource } from '@prisma/client'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

// ============= Validation Schemas =============

export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  source: z.enum(['MANUAL', 'SHADOW_EVENT_AUTOMATION']).default('MANUAL'),
  assignedToId: z.string().optional().nullable(),
})

export const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  assignedToId: z.string().optional().nullable(),
})

export const ListTicketsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  assignedToId: z.string().optional(),
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
  if (validated.assignedToId) {
    where.assignedToId = validated.assignedToId
  }

  // Check if user can see all tickets, otherwise only show assigned tickets
  const canReadAll = await can(userId, PERMISSIONS.TICKETS_READ_ALL)
  if (!canReadAll) {
    where.assignedToId = userId
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: validated.limit,
    skip: validated.offset,
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return tickets
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
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!ticket) return null

  // Check if user can view all tickets or if they're assigned to this ticket
  const canReadAll = await can(userId, PERMISSIONS.TICKETS_READ_ALL)
  if (!canReadAll && ticket.assignedToId !== userId) {
    throw new Error('Access denied: You can only view tickets assigned to you')
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
      source: validated.source,
      status: 'OPEN',
      assignedToId: validated.assignedToId,
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
  if (!canUpdateAll && (validated.title || validated.description || validated.assignedToId)) {
    throw new Error('Insufficient permissions to update ticket details')
  }

  const updateData: any = {}
  if (validated.title !== undefined) updateData.title = validated.title
  if (validated.description !== undefined) updateData.description = validated.description
  if (validated.status !== undefined) updateData.status = validated.status
  if (validated.assignedToId !== undefined) updateData.assignedToId = validated.assignedToId

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
          source: data.source,
          status: 'OPEN',
          assignedToId: data.assignedToId,
        } as any,
      })
    )
  )

  return created
}

