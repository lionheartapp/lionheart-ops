/**
 * AI Assistant — Maintenance Domain Tools
 *
 * Existing: query_maintenance_stats, get_ticket_details, create_maintenance_ticket,
 *           update_maintenance_ticket_status, assign_maintenance_ticket
 * New:      list_maintenance_tickets, list_ticket_comments, claim_maintenance_ticket,
 *           add_ticket_comment, update_maintenance_ticket, delete_maintenance_ticket
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { prisma, rawPrisma } from '@/lib/db'
import type { RichConfirmationCardData } from '@/lib/types/assistant'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getTicketsByStatus,
  getResolutionTimeByCategory,
  getTechnicianWorkload as getMaintenanceTechWorkload,
  getPmComplianceRate,
  getCategoryBreakdown,
  getTopTicketLocations,
  type AnalyticsOptions,
} from '@/lib/services/maintenanceAnalyticsService'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveTicket(ticketId: string) {
  let ticket = await prisma.maintenanceTicket
    .findUnique({ where: { id: ticketId }, select: { id: true, ticketNumber: true, title: true, status: true } })
    .catch(() => null)
  if (!ticket) {
    ticket = await prisma.maintenanceTicket
      .findFirst({ where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } }, select: { id: true, ticketNumber: true, title: true, status: true } })
      .catch(() => null)
  }
  return ticket
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: Maintenance Analytics ─────────────────────────────────────────
  query_maintenance_stats: {
    definition: {
      name: 'query_maintenance_stats',
      description:
        'Query maintenance analytics for the organization. Returns statistics about maintenance tickets, technician workload, PM compliance, costs, and more.',
      parameters: {
        type: 'object',
        properties: {
          stat_type: {
            type: 'string',
            enum: ['tickets_by_status', 'resolution_time_by_category', 'technician_workload', 'pm_compliance', 'category_breakdown', 'top_locations'],
            description: 'Which maintenance metric to retrieve',
          },
          campus_id: { type: 'string', description: 'Optional campus/school ID to filter by' },
          months: { type: 'number', description: 'Number of months of history to include (default: 6)' },
        },
        required: ['stat_type'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const statType = input.stat_type as string
      const opts: AnalyticsOptions = {
        campusId: input.campus_id as string | undefined,
        months: (input.months as number) || 6,
      }
      switch (statType) {
        case 'tickets_by_status': return JSON.stringify(await getTicketsByStatus(ctx.organizationId, opts))
        case 'resolution_time_by_category': return JSON.stringify(await getResolutionTimeByCategory(ctx.organizationId, opts))
        case 'technician_workload': return JSON.stringify(await getMaintenanceTechWorkload(ctx.organizationId, opts))
        case 'pm_compliance': return JSON.stringify(await getPmComplianceRate(ctx.organizationId, opts))
        case 'category_breakdown': return JSON.stringify(await getCategoryBreakdown(ctx.organizationId, opts))
        case 'top_locations': return JSON.stringify(await getTopTicketLocations(ctx.organizationId, opts))
        default: return JSON.stringify({ error: `Unknown stat type: ${statType}` })
      }
    },
  },

  // ── GREEN: Ticket Details ────────────────────────────────────────────────
  get_ticket_details: {
    definition: {
      name: 'get_ticket_details',
      description: 'Get detailed information about a specific maintenance ticket by its ID or ticket number.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_READ_ALL,
    riskTier: 'GREEN',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const ticketSelect = {
        id: true, ticketNumber: true, title: true, description: true, status: true,
        category: true, priority: true, createdAt: true, updatedAt: true,
        building: { select: { name: true } },
        room: { select: { roomNumber: true, displayName: true } },
        submittedBy: { select: { name: true, email: true } },
        assignedTo: { select: { name: true, email: true } },
      } as const

      let ticket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId }, select: ticketSelect }).catch(() => null)
      if (!ticket) {
        ticket = await prisma.maintenanceTicket.findFirst({ where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } }, select: ticketSelect }).catch(() => null)
      }
      if (!ticket) return JSON.stringify({ error: `Ticket not found: ${ticketId}` })
      return JSON.stringify(ticket)
    },
  },

  // ── GREEN: List Maintenance Tickets ──────────────────────────────────────
  list_maintenance_tickets: {
    definition: {
      name: 'list_maintenance_tickets',
      description: 'List maintenance tickets with optional filters. Supports date range filtering for questions like "tickets completed last week" or "tickets created this month". Returns ticket number, title, status, priority, category, assignee, and creation date.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'QA', 'DONE', 'CANCELLED'], description: 'Filter by status' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Filter by priority' },
          category: { type: 'string', enum: ['ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL', 'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER'], description: 'Filter by category' },
          assigned_to_me: { type: 'boolean', description: 'Only show tickets assigned to the current user' },
          created_after: { type: 'string', description: 'ISO 8601 date string. Only return tickets created on or after this date (e.g. "2026-03-01T00:00:00")' },
          created_before: { type: 'string', description: 'ISO 8601 date string. Only return tickets created before this date (e.g. "2026-03-08T00:00:00")' },
          updated_after: { type: 'string', description: 'ISO 8601 date string. Only return tickets updated on or after this date — useful for finding tickets completed/changed in a date range' },
          updated_before: { type: 'string', description: 'ISO 8601 date string. Only return tickets updated before this date' },
          limit: { type: 'number', description: 'Max tickets to return (default: 15)' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_READ_ALL,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const limit = Math.min((input.limit as number) || 15, 50)
      const where: Record<string, unknown> = {}
      if (input.status) where.status = input.status
      if (input.priority) where.priority = input.priority
      if (input.category) where.category = input.category
      if (input.assigned_to_me) where.assignedToId = ctx.userId

      // Date range filters
      if (input.created_after || input.created_before) {
        const createdAt: Record<string, Date> = {}
        if (input.created_after) createdAt.gte = new Date(String(input.created_after))
        if (input.created_before) createdAt.lt = new Date(String(input.created_before))
        where.createdAt = createdAt
      }
      if (input.updated_after || input.updated_before) {
        const updatedAt: Record<string, Date> = {}
        if (input.updated_after) updatedAt.gte = new Date(String(input.updated_after))
        if (input.updated_before) updatedAt.lt = new Date(String(input.updated_before))
        where.updatedAt = updatedAt
      }

      const tickets = await prisma.maintenanceTicket.findMany({
        where,
        select: {
          id: true, ticketNumber: true, title: true, status: true, priority: true,
          category: true, createdAt: true, updatedAt: true,
          assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return JSON.stringify({
        tickets: tickets.map(t => ({
          id: t.id, number: t.ticketNumber, title: t.title, status: t.status,
          priority: t.priority, category: t.category, assignedTo: t.assignedTo?.name || null,
          created: t.createdAt, updated: t.updatedAt,
        })),
        count: tickets.length,
      })
    },
  },

  // ── GREEN: List Ticket Comments ──────────────────────────────────────────
  list_ticket_comments: {
    definition: {
      name: 'list_ticket_comments',
      description: 'Get the activity log / comments for a specific maintenance ticket.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
          limit: { type: 'number', description: 'Max comments to return (default: 20)' },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_READ_ALL,
    riskTier: 'GREEN',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const limit = Math.min((input.limit as number) || 20, 50)
      const ticket = await resolveTicket(ticketId)
      if (!ticket) return JSON.stringify({ error: `Ticket not found: ${ticketId}` })

      const activities = await prisma.maintenanceTicketActivity.findMany({
        where: { ticketId: ticket.id },
        select: { id: true, type: true, content: true, createdAt: true, actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return JSON.stringify({
        ticket: ticket.ticketNumber,
        activities: activities.map(a => ({
          type: a.type, content: a.content, by: (a as any).actor?.name, at: a.createdAt,
        })),
        count: activities.length,
      })
    },
  },

  // ── YELLOW: Claim Maintenance Ticket ─────────────────────────────────────
  claim_maintenance_ticket: {
    definition: {
      name: 'claim_maintenance_ticket',
      description: 'Self-claim a maintenance ticket (assign it to the current user). Executes immediately without confirmation.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_CLAIM,
    riskTier: 'YELLOW',
    execute: async (input, ctx) => {
      const ticketId = String(input.ticket_id || '')
      const ticket = await resolveTicket(ticketId)
      if (!ticket) return JSON.stringify({ error: `Ticket not found: ${ticketId}` })

      const { claimTicket } = await import('@/lib/services/maintenanceTicketService')
      await claimTicket(ticket.id, ctx.userId, ctx.organizationId)
      return JSON.stringify({
        executed: true,
        message: `Ticket ${ticket.ticketNumber} has been claimed by you.`,
      })
    },
  },

  // ── YELLOW: Add Ticket Comment ───────────────────────────────────────────
  add_ticket_comment: {
    definition: {
      name: 'add_ticket_comment',
      description: 'Add a comment or note to a maintenance ticket. Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
          comment: { type: 'string', description: 'The comment text to add' },
        },
        required: ['ticket_id', 'comment'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_UPDATE_OWN,
    riskTier: 'YELLOW',
    execute: async (input, ctx) => {
      const ticketId = String(input.ticket_id || '')
      const comment = String(input.comment || '')
      if (!comment) return JSON.stringify({ error: 'Comment text is required.' })

      const ticket = await resolveTicket(ticketId)
      if (!ticket) return JSON.stringify({ error: `Ticket not found: ${ticketId}` })

      await prisma.maintenanceTicketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: ctx.userId,
          type: 'COMMENT',
          content: comment,
          organizationId: ctx.organizationId,
        },
      })

      return JSON.stringify({
        executed: true,
        message: `Comment added to ticket ${ticket.ticketNumber}.`,
      })
    },
  },

  // ── ORANGE: Create Maintenance Ticket (Draft) ───────────────────────────
  create_maintenance_ticket: {
    definition: {
      name: 'create_maintenance_ticket',
      description:
        'Draft a new maintenance ticket. ALWAYS generate a descriptive title from the user\'s report — never ask them for a title. Infer the category from keywords (water/pipe/leak=PLUMBING, electrical/power=ELECTRICAL, heating/cooling/AC=HVAC, roof/wall/floor=STRUCTURAL, cleaning/spill=CUSTODIAL_BIOHAZARD, technology/wifi=IT_AV, landscaping/parking=GROUNDS). Infer priority from severity (safety hazard/flooding/gas=URGENT, broken/non-functional=HIGH, minor/cosmetic=LOW, everything else=MEDIUM). Extract location from the message. Returns a summary for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the ticket' },
          description: { type: 'string', description: 'Detailed description of the issue' },
          category: {
            type: 'string',
            enum: ['ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL', 'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER'],
            description: 'Maintenance category',
          },
          location: { type: 'string', description: 'Building or room name where the issue is located' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Priority level (default: MEDIUM)' },
        },
        required: ['title', 'category'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_SUBMIT,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const draft = {
        action: 'create_maintenance_ticket',
        title: String(input.title || ''),
        description: String(input.description || ''),
        category: String(input.category || 'OTHER'),
        location: String(input.location || 'Not specified'),
        priority: String(input.priority || 'MEDIUM'),
      }
      const richCard = {
        cardType: 'ticket' as const,
        title: draft.title,
        category: draft.category,
        priority: draft.priority,
        location: draft.location !== 'Not specified' ? draft.location : undefined,
        description: draft.description || undefined,
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `I've prepared a maintenance ticket for your review.`,
        draft,
        richCard,
      })
    },
  },

  // ── ORANGE: Update Maintenance Ticket Status ────────────────────────────
  update_maintenance_ticket_status: {
    definition: {
      name: 'update_maintenance_ticket_status',
      description: 'Update the status of a maintenance ticket (e.g. move to In Progress, mark as Done, cancel). Returns a confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
          new_status: { type: 'string', enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'QA', 'DONE', 'CANCELLED'], description: 'The new status to set' },
          note: { type: 'string', description: 'Optional note (required for QA completion or cancellation)' },
        },
        required: ['ticket_id', 'new_status'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_UPDATE_ALL,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const newStatus = String(input.new_status || '')
      const note = String(input.note || '')

      let ticketInfo = ''
      const ticket = await resolveTicket(ticketId)
      if (ticket) {
        ticketInfo = `\n• Ticket: ${ticket.ticketNumber} — ${ticket.title}\n• Current Status: ${ticket.status}`
      }

      const draft = { action: 'update_maintenance_ticket_status', ticketId, newStatus, note }
      return JSON.stringify({
        confirmationRequired: true,
        message: `I'll update this maintenance ticket's status. Please confirm:${ticketInfo}\n• New Status: ${newStatus}${note ? `\n• Note: ${note}` : ''}`,
        draft,
      })
    },
  },

  // ── ORANGE: Assign Maintenance Ticket ───────────────────────────────────
  assign_maintenance_ticket: {
    definition: {
      name: 'assign_maintenance_ticket',
      description: 'Assign a maintenance ticket to a specific user/technician. Search for the user first to get their ID.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
          assignee_name: { type: 'string', description: 'Name or email of the person to assign to' },
        },
        required: ['ticket_id', 'assignee_name'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_ASSIGN,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const assigneeName = String(input.assignee_name || '')

      let assigneeId: string | null = null
      let assigneeDisplay = assigneeName
      try {
        const user = await prisma.user.findFirst({
          where: { OR: [{ name: { contains: assigneeName, mode: 'insensitive' } }, { email: { contains: assigneeName, mode: 'insensitive' } }] },
          select: { id: true, name: true, email: true },
        })
        if (user) { assigneeId = user.id; assigneeDisplay = `${user.name} (${user.email})` }
      } catch { /* non-critical */ }

      if (!assigneeId) {
        return JSON.stringify({ error: `Could not find a user matching "${assigneeName}". Try searching for them first.` })
      }

      const draft = { action: 'assign_maintenance_ticket', ticketId, assigneeId, assigneeName: assigneeDisplay }
      return JSON.stringify({
        confirmationRequired: true,
        message: `I'll assign this ticket. Please confirm:\n• Ticket: ${ticketId}\n• Assign to: ${assigneeDisplay}`,
        draft,
      })
    },
  },

  // ── ORANGE: Update Maintenance Ticket ───────────────────────────────────
  update_maintenance_ticket: {
    definition: {
      name: 'update_maintenance_ticket',
      description: 'Update the title, description, category, or priority of a maintenance ticket. Returns a confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
          title: { type: 'string', description: 'New title (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
          category: { type: 'string', enum: ['ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL', 'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER'], description: 'New category (optional)' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'New priority (optional)' },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_UPDATE_ALL,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const ticket = await resolveTicket(ticketId)
      if (!ticket) return JSON.stringify({ error: `Ticket not found: ${ticketId}` })

      const changes: string[] = []
      if (input.title) changes.push(`Title → "${input.title}"`)
      if (input.description) changes.push(`Description updated`)
      if (input.category) changes.push(`Category → ${input.category}`)
      if (input.priority) changes.push(`Priority → ${input.priority}`)

      if (changes.length === 0) return JSON.stringify({ error: 'No changes specified.' })

      const draft = {
        action: 'update_maintenance_ticket',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ...(input.title ? { title: String(input.title) } : {}),
        ...(input.description ? { description: String(input.description) } : {}),
        ...(input.category ? { category: String(input.category) } : {}),
        ...(input.priority ? { priority: String(input.priority) } : {}),
      }

      return JSON.stringify({
        confirmationRequired: true,
        message: `I'll update ticket ${ticket.ticketNumber}:\n${changes.map(c => `• ${c}`).join('\n')}`,
        draft,
      })
    },
  },

  // ── RED: Delete Maintenance Ticket ──────────────────────────────────────
  delete_maintenance_ticket: {
    definition: {
      name: 'delete_maintenance_ticket',
      description: 'Delete (soft-delete) a maintenance ticket. This is a destructive action. Returns a confirmation with warning before executing.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID or ticket number' },
          reason: { type: 'string', description: 'Reason for deletion' },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_CANCEL,
    riskTier: 'RED',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const ticket = await resolveTicket(ticketId)
      if (!ticket) return JSON.stringify({ error: `Ticket not found: ${ticketId}` })

      const draft = {
        action: 'delete_maintenance_ticket',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        reason: String(input.reason || ''),
      }

      return JSON.stringify({
        confirmationRequired: true,
        riskTier: 'RED',
        riskWarning: `This will permanently archive ticket ${ticket.ticketNumber} ("${ticket.title}"). This action cannot be undone.`,
        message: `Delete ticket ${ticket.ticketNumber} — "${ticket.title}"?`,
        draft,
      })
    },
  },
}

registerTools(tools)
