/**
 * Maintenance Ticket Queries
 *
 * Read-only operations: get detail, list with filters.
 * Extracted from maintenanceTicketService.ts for focused modules.
 */

import { prisma, rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { canAny } from '@/lib/auth/permissions'
import type {
  MaintenanceTicketStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceSpecialty,
} from '@prisma/client'

// ─── Shared includes ─────────────────────────────────────────────────────────

export const TICKET_INCLUDES = {
  submittedBy: {
    select: { id: true, firstName: true, lastName: true, email: true, avatar: true, userRole: { select: { name: true } } },
  },
  assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  building: { select: { id: true, name: true } },
  space: { select: { id: true, name: true } },
  room: { select: { id: true, roomNumber: true, displayName: true } },
  campus: { select: { id: true, name: true } },
  asset: {
    select: {
      repeatAlertSentAt: true,
      costAlertSentAt: true,
      eolAlertSentAt: true,
    },
  },
} as const

// ─── UserContext type (matches request-context) ──────────────────────────────

interface UserContext {
  userId: string
  organizationId: string
  email?: string
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
          actor: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      watchers: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      },
    },
  })

  if (!ticket) return null

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

  if (hasReadAll) {
    // Head/admin sees everything
  } else if (hasClaim) {
    where.OR = [
      { assignedToId: null },
      { assignedToId: ctx.userId },
    ]
  } else {
    where.submittedById = ctx.userId
  }

  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.category) where.category = filters.category
  if (filters.schoolId) where.campusId = filters.schoolId
  if (filters.assignedToId !== undefined) where.assignedToId = filters.assignedToId
  if (filters.unassigned) where.assignedToId = null
  if (filters.excludeStatus) {
    where.NOT = { status: filters.excludeStatus }
  }
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' }
  }

  const tickets = await prisma.maintenanceTicket.findMany({
    where,
    include: {
      ...TICKET_INCLUDES,
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })

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
