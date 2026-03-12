/**
 * AI Assistant — IT Domain Tools
 *
 * Existing: query_it_stats, get_device_info, create_it_ticket
 * New:      list_it_tickets, get_it_ticket_details, update_it_ticket_status,
 *           add_it_ticket_comment, assign_it_ticket
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getTicketVolumeByType,
  getDeviceHealthByCampus,
  getLemonDeviceReport,
  getRepairCostByModel,
  getSLACompliance,
  getLoanerPoolUtilization,
  type ITAnalyticsOptions,
} from '@/lib/services/itAnalyticsService'

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: IT Analytics ──────────────────────────────────────────────────
  query_it_stats: {
    definition: {
      name: 'query_it_stats',
      description: 'Query IT analytics for the organization. Returns statistics about IT tickets, device health, repair costs, SLA compliance, and loaner utilization.',
      parameters: {
        type: 'object',
        properties: {
          stat_type: {
            type: 'string',
            enum: ['ticket_volume_by_type', 'device_health', 'lemon_devices', 'repair_cost_by_model', 'sla_compliance', 'loaner_utilization'],
            description: 'Which IT metric to retrieve',
          },
          school_id: { type: 'string', description: 'Optional school ID to filter by' },
          months: { type: 'number', description: 'Number of months of history to include (default: 6)' },
        },
        required: ['stat_type'],
      },
    },
    requiredPermission: PERMISSIONS.IT_ANALYTICS_READ,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const statType = input.stat_type as string
      const opts: ITAnalyticsOptions = {
        schoolId: input.school_id as string | undefined,
        months: (input.months as number) || 6,
      }
      switch (statType) {
        case 'ticket_volume_by_type': return JSON.stringify(await getTicketVolumeByType(ctx.organizationId, opts))
        case 'device_health': return JSON.stringify(await getDeviceHealthByCampus(ctx.organizationId, opts))
        case 'lemon_devices': return JSON.stringify(await getLemonDeviceReport(ctx.organizationId, opts))
        case 'repair_cost_by_model': return JSON.stringify(await getRepairCostByModel(ctx.organizationId, opts))
        case 'sla_compliance': return JSON.stringify(await getSLACompliance(ctx.organizationId, opts))
        case 'loaner_utilization': return JSON.stringify(await getLoanerPoolUtilization(ctx.organizationId, opts))
        default: return JSON.stringify({ error: `Unknown stat type: ${statType}` })
      }
    },
  },

  // ── GREEN: Device Info ───────────────────────────────────────────────────
  get_device_info: {
    definition: {
      name: 'get_device_info',
      description: 'Get detailed information about an IT device by its asset tag or ID, including repair history.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'The device asset tag or device ID' },
        },
        required: ['identifier'],
      },
    },
    requiredPermission: PERMISSIONS.IT_DEVICE_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const identifier = String(input.identifier || '')
      const deviceSelect = {
        id: true, assetTag: true, deviceType: true, make: true, model: true,
        status: true, isLemon: true, purchaseDate: true,
        repairs: { orderBy: { repairDate: 'desc' as const }, take: 5, select: { repairType: true, description: true, repairCost: true, repairDate: true } },
      } as const

      let device = await prisma.iTDevice.findUnique({ where: { id: identifier }, select: deviceSelect }).catch(() => null)
      if (!device) {
        device = await prisma.iTDevice.findFirst({ where: { assetTag: { equals: identifier, mode: 'insensitive' } }, select: deviceSelect }).catch(() => null)
      }
      if (!device) return JSON.stringify({ error: `Device not found: ${identifier}` })
      return JSON.stringify(device)
    },
  },

  // ── GREEN: List IT Tickets ───────────────────────────────────────────────
  list_it_tickets: {
    definition: {
      name: 'list_it_tickets',
      description: 'List IT support tickets with optional filters.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'], description: 'Filter by status' },
          issue_type: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCOUNT_ACCESS', 'DISPLAY_AV', 'PRINTER', 'OTHER'], description: 'Filter by issue type' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Filter by priority' },
          limit: { type: 'number', description: 'Max tickets to return (default: 15)' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_READ_ALL,
    riskTier: 'GREEN',
    execute: async (input) => {
      const limit = Math.min((input.limit as number) || 15, 50)
      const where: Record<string, unknown> = {}
      if (input.status) where.status = input.status
      if (input.issue_type) where.issueType = input.issue_type
      if (input.priority) where.priority = input.priority

      const tickets = await prisma.iTTicket.findMany({
        where,
        select: {
          id: true, ticketNumber: true, title: true, status: true, priority: true,
          issueType: true, createdAt: true,
          assignedTo: { select: { name: true } },
          submittedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return JSON.stringify({
        tickets: tickets.map(t => ({
          id: t.id, number: t.ticketNumber, title: t.title, status: t.status,
          priority: t.priority, issueType: t.issueType,
          assignedTo: t.assignedTo?.name || null, submittedBy: t.submittedBy?.name || null,
          created: t.createdAt,
        })),
        count: tickets.length,
      })
    },
  },

  // ── GREEN: Get IT Ticket Details ─────────────────────────────────────────
  get_it_ticket_details: {
    definition: {
      name: 'get_it_ticket_details',
      description: 'Get detailed information about a specific IT ticket by its ID or ticket number.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The IT ticket ID or ticket number' },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_READ_ALL,
    riskTier: 'GREEN',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const { getITTicketDetail } = await import('@/lib/services/itTicketService')
      try {
        const detail = await getITTicketDetail(ticketId)
        if (!detail) return JSON.stringify({ error: `IT ticket not found: ${ticketId}` })
        return JSON.stringify(detail)
      } catch {
        return JSON.stringify({ error: `IT ticket not found: ${ticketId}` })
      }
    },
  },

  // ── ORANGE: Create IT Ticket (Draft) ─────────────────────────────────────
  create_it_ticket: {
    definition: {
      name: 'create_it_ticket',
      description: 'Draft a new IT support ticket. Returns a summary for user confirmation before creating.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title describing the IT issue' },
          description: { type: 'string', description: 'Detailed description of the issue' },
          issue_type: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCOUNT_ACCESS', 'DISPLAY_AV', 'PRINTER', 'OTHER'], description: 'Type of IT issue' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Priority level (default: MEDIUM)' },
        },
        required: ['title', 'issue_type'],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_SUBMIT,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const draft = {
        action: 'create_it_ticket',
        title: String(input.title || ''),
        description: String(input.description || ''),
        issueType: String(input.issue_type || 'OTHER'),
        priority: String(input.priority || 'MEDIUM'),
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `I've prepared an IT ticket draft. Please confirm to create it:\n• Title: ${draft.title}\n• Issue Type: ${draft.issueType}\n• Priority: ${draft.priority}${draft.description ? `\n• Description: ${draft.description}` : ''}`,
        draft,
      })
    },
  },

  // ── ORANGE: Update IT Ticket Status ──────────────────────────────────────
  update_it_ticket_status: {
    definition: {
      name: 'update_it_ticket_status',
      description: 'Update the status of an IT ticket. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The IT ticket ID or ticket number' },
          new_status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'], description: 'The new status' },
          note: { type: 'string', description: 'Optional note about the status change' },
        },
        required: ['ticket_id', 'new_status'],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_UPDATE_STATUS,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const newStatus = String(input.new_status || '')

      let ticket = await prisma.iTTicket.findUnique({ where: { id: ticketId }, select: { id: true, ticketNumber: true, title: true, status: true } }).catch(() => null)
      if (!ticket) {
        ticket = await prisma.iTTicket.findFirst({ where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } }, select: { id: true, ticketNumber: true, title: true, status: true } }).catch(() => null)
      }
      if (!ticket) return JSON.stringify({ error: `IT ticket not found: ${ticketId}` })

      const draft = {
        action: 'update_it_ticket_status',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        newStatus,
        note: String(input.note || ''),
      }

      return JSON.stringify({
        confirmationRequired: true,
        message: `Update IT ticket ${ticket.ticketNumber} "${ticket.title}":\n• ${ticket.status} → ${newStatus}`,
        draft,
      })
    },
  },

  // ── YELLOW: Add IT Ticket Comment ────────────────────────────────────────
  add_it_ticket_comment: {
    definition: {
      name: 'add_it_ticket_comment',
      description: 'Add a comment to an IT ticket. Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The IT ticket ID or ticket number' },
          comment: { type: 'string', description: 'The comment text to add' },
        },
        required: ['ticket_id', 'comment'],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
    riskTier: 'YELLOW',
    execute: async (input, ctx) => {
      const ticketId = String(input.ticket_id || '')
      const comment = String(input.comment || '')
      if (!comment) return JSON.stringify({ error: 'Comment text is required.' })

      let ticket = await prisma.iTTicket.findUnique({ where: { id: ticketId }, select: { id: true, ticketNumber: true } }).catch(() => null)
      if (!ticket) {
        ticket = await prisma.iTTicket.findFirst({ where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } }, select: { id: true, ticketNumber: true } }).catch(() => null)
      }
      if (!ticket) return JSON.stringify({ error: `IT ticket not found: ${ticketId}` })

      const { addITTicketComment } = await import('@/lib/services/itTicketService')
      await addITTicketComment(ticket.id, comment, false, { userId: ctx.userId, organizationId: ctx.organizationId })

      return JSON.stringify({
        executed: true,
        message: `Comment added to IT ticket ${ticket.ticketNumber}.`,
      })
    },
  },

  // ── ORANGE: Assign IT Ticket ─────────────────────────────────────────────
  assign_it_ticket: {
    definition: {
      name: 'assign_it_ticket',
      description: 'Assign an IT ticket to a specific user. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The IT ticket ID or ticket number' },
          assignee_name: { type: 'string', description: 'Name or email of the person to assign to' },
        },
        required: ['ticket_id', 'assignee_name'],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_ASSIGN,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const ticketId = String(input.ticket_id || '')
      const assigneeName = String(input.assignee_name || '')

      let ticket = await prisma.iTTicket.findUnique({ where: { id: ticketId }, select: { id: true, ticketNumber: true, title: true } }).catch(() => null)
      if (!ticket) {
        ticket = await prisma.iTTicket.findFirst({ where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } }, select: { id: true, ticketNumber: true, title: true } }).catch(() => null)
      }
      if (!ticket) return JSON.stringify({ error: `IT ticket not found: ${ticketId}` })

      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: assigneeName, mode: 'insensitive' } }, { email: { contains: assigneeName, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${assigneeName}".` })

      const draft = {
        action: 'assign_it_ticket',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        assigneeId: user.id,
        assigneeName: `${user.name} (${user.email})`,
      }

      return JSON.stringify({
        confirmationRequired: true,
        message: `Assign IT ticket ${ticket.ticketNumber} to ${user.name}?`,
        draft,
      })
    },
  },
}

registerTools(tools)
