/**
 * Platform Support Ticket Service
 * 
 * Manages support tickets between schools and the platform admin team.
 * Uses rawPrisma — not org-scoped.
 */

import { rawPrisma } from '@/lib/db'
import { PlatformTicketCategory, PlatformTicketStatus, TicketPriority, PlatformSenderType } from '@prisma/client'

/**
 * Create a support ticket (submitted by org user or platform admin)
 */
export async function createSupportTicket(params: {
  organizationId?: string
  submittedByUserId?: string
  subject: string
  description: string
  category?: PlatformTicketCategory
  priority?: TicketPriority
}) {
  return rawPrisma.platformSupportTicket.create({
    data: {
      organizationId: params.organizationId || null,
      submittedByUserId: params.submittedByUserId || null,
      subject: params.subject,
      description: params.description,
      category: params.category || 'GENERAL',
      priority: params.priority || 'NORMAL',
      status: 'OPEN',
    },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  })
}

/**
 * Update ticket status/assignment
 */
export async function updateSupportTicket(
  ticketId: string,
  data: {
    status?: PlatformTicketStatus
    priority?: TicketPriority
    assignedToAdminId?: string | null
    category?: PlatformTicketCategory
  }
) {
  return rawPrisma.platformSupportTicket.update({
    where: { id: ticketId },
    data,
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      assignedTo: { select: { id: true, email: true, name: true } },
    },
  })
}

/**
 * Add a message to a support ticket
 */
export async function addSupportMessage(params: {
  ticketId: string
  senderId: string
  senderType: PlatformSenderType
  message: string
}) {
  // Create message and update ticket's updatedAt
  const [message] = await rawPrisma.$transaction([
    rawPrisma.platformSupportMessage.create({
      data: {
        ticketId: params.ticketId,
        senderId: params.senderId,
        senderType: params.senderType,
        message: params.message,
      },
    }),
    rawPrisma.platformSupportTicket.update({
      where: { id: params.ticketId },
      data: { updatedAt: new Date() },
    }),
  ])

  return message
}

/**
 * Get ticket with all messages
 */
export async function getTicketWithMessages(ticketId: string) {
  const ticket = await rawPrisma.platformSupportTicket.findUnique({
    where: { id: ticketId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      assignedTo: { select: { id: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!ticket) return null

  const submittedBy = ticket.submittedByUserId
    ? await rawPrisma.user.findUnique({
        where: { id: ticket.submittedByUserId },
        select: { id: true, email: true, firstName: true, lastName: true, name: true },
      })
    : null

  return { ...ticket, submittedBy }
}

/**
 * List support tickets with filters
 */
export async function listSupportTickets(params: {
  status?: PlatformTicketStatus
  category?: PlatformTicketCategory
  priority?: TicketPriority
  organizationId?: string
  assignedToAdminId?: string
  page?: number
  perPage?: number
}) {
  const { status, category, priority, organizationId, assignedToAdminId, page = 1, perPage = 50 } = params

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (category) where.category = category
  if (priority) where.priority = priority
  if (organizationId) where.organizationId = organizationId
  if (assignedToAdminId) where.assignedToAdminId = assignedToAdminId

  const [tickets, total] = await Promise.all([
    rawPrisma.platformSupportTicket.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    rawPrisma.platformSupportTicket.count({ where }),
  ])

  // Batch-fetch submitter info for all tickets
  const submitterIds = [...new Set(tickets.map((t) => t.submittedByUserId).filter(Boolean))] as string[]
  const submitters = submitterIds.length > 0
    ? await rawPrisma.user.findMany({
        where: { id: { in: submitterIds } },
        select: { id: true, email: true, firstName: true, lastName: true, name: true },
      })
    : []
  const submitterMap = new Map(submitters.map((u) => [u.id, u]))

  const ticketsWithSubmitter = tickets.map((t) => ({
    ...t,
    submittedBy: t.submittedByUserId ? submitterMap.get(t.submittedByUserId) ?? null : null,
  }))

  return { tickets: ticketsWithSubmitter, total, page, perPage }
}

/**
 * List tickets for a specific organization (school-facing)
 */
export async function listOrgSupportTickets(organizationId: string, params: {
  status?: PlatformTicketStatus
  submittedByUserId?: string
  page?: number
  perPage?: number
}) {
  const { status, submittedByUserId, page = 1, perPage = 20 } = params

  const where: Record<string, unknown> = { organizationId }
  if (status) where.status = status
  if (submittedByUserId) where.submittedByUserId = submittedByUserId

  const [tickets, total] = await Promise.all([
    rawPrisma.platformSupportTicket.findMany({
      where,
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    rawPrisma.platformSupportTicket.count({ where }),
  ])

  return { tickets, total, page, perPage }
}
