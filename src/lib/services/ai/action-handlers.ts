/**
 * AI Assistant — Action Handlers Registry
 *
 * Centralized handlers for all ORANGE/RED confirmed actions.
 * The confirm route calls `executeAction()` which looks up the handler,
 * checks permission, and executes the write operation.
 */

import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { createEvent as createCalendarEvent } from '@/lib/services/calendarService'
import { clearPermissionCache } from '@/lib/auth/permissions'

interface ActionContext {
  userId: string
  organizationId: string
}

interface ActionHandler {
  requiredPermission: string
  execute: (payload: Record<string, unknown>, ctx: ActionContext) => Promise<{ message: string }>
}

/** Ensure a date string is full ISO 8601 */
function ensureISODate(dateStr: string): string {
  if (!dateStr) return dateStr
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d.toISOString()
  const cleaned = dateStr.replace(/,/g, '').trim()
  d = new Date(cleaned)
  if (!isNaN(d.getTime())) return d.toISOString()
  return dateStr
}

/** Resolve a maintenance ticket by ID or ticketNumber */
async function resolveMaintenanceTicket(ticketId: string) {
  let ticket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId }, select: { id: true, ticketNumber: true } }).catch(() => null)
  if (!ticket) {
    ticket = await prisma.maintenanceTicket.findFirst({
      where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } },
      select: { id: true, ticketNumber: true },
    }).catch(() => null)
  }
  return ticket
}

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  // ── Maintenance ────────────────────────────────────────────────────────
  create_maintenance_ticket: {
    requiredPermission: PERMISSIONS.MAINTENANCE_SUBMIT,
    execute: async (payload, ctx) => {
      const { createMaintenanceTicket } = await import('@/lib/services/maintenanceTicketService')
      const location = payload.location ? String(payload.location) : ''
      const baseDescription = String(payload.description || '')
      const fullDescription = location && !baseDescription.includes(location)
        ? `${baseDescription}${baseDescription ? '\n' : ''}Location: ${location}` : baseDescription

      const ticket = await createMaintenanceTicket({
        title: String(payload.title || ''),
        description: fullDescription,
        category: String(payload.category || 'OTHER') as any,
        priority: String(payload.priority || 'MEDIUM') as any,
      }, ctx.userId, ctx.organizationId)
      return { message: `Maintenance ticket ${(ticket as any).ticketNumber || ''} created: "${(ticket as any).title}"` }
    },
  },

  update_maintenance_ticket_status: {
    requiredPermission: PERMISSIONS.MAINTENANCE_UPDATE_ALL,
    execute: async (payload) => {
      const ticket = await resolveMaintenanceTicket(String(payload.ticketId))
      if (!ticket) throw new Error('Ticket not found')
      const updated = await prisma.maintenanceTicket.update({
        where: { id: ticket.id },
        data: { status: String(payload.newStatus) as any, ...(payload.note ? { completionNote: String(payload.note) } : {}) },
        select: { ticketNumber: true, status: true },
      })
      return { message: `Ticket ${updated.ticketNumber} updated to ${updated.status}` }
    },
  },

  assign_maintenance_ticket: {
    requiredPermission: PERMISSIONS.MAINTENANCE_ASSIGN,
    execute: async (payload) => {
      const ticket = await resolveMaintenanceTicket(String(payload.ticketId))
      if (!ticket) throw new Error('Ticket not found')
      const updated = await prisma.maintenanceTicket.update({
        where: { id: ticket.id },
        data: { assignedToId: String(payload.assigneeId) },
        select: { ticketNumber: true, assignedTo: { select: { name: true } } },
      })
      return { message: `Ticket ${updated.ticketNumber} assigned to ${updated.assignedTo?.name || 'user'}` }
    },
  },

  update_maintenance_ticket: {
    requiredPermission: PERMISSIONS.MAINTENANCE_UPDATE_ALL,
    execute: async (payload) => {
      const data: Record<string, unknown> = {}
      if (payload.title) data.title = String(payload.title)
      if (payload.description) data.description = String(payload.description)
      if (payload.category) data.category = String(payload.category)
      if (payload.priority) data.priority = String(payload.priority)
      const updated = await prisma.maintenanceTicket.update({
        where: { id: String(payload.ticketId) },
        data: data as any,
        select: { ticketNumber: true, title: true },
      })
      return { message: `Ticket ${updated.ticketNumber} updated.` }
    },
  },

  delete_maintenance_ticket: {
    requiredPermission: PERMISSIONS.MAINTENANCE_CANCEL,
    execute: async (payload) => {
      const updated = await prisma.maintenanceTicket.update({
        where: { id: String(payload.ticketId) },
        data: { status: 'CANCELLED' as any },
        select: { ticketNumber: true },
      })
      return { message: `Ticket ${updated.ticketNumber} has been cancelled.` }
    },
  },

  // ── Events ─────────────────────────────────────────────────────────────
  create_event: {
    requiredPermission: PERMISSIONS.EVENTS_CREATE,
    execute: async (payload, ctx) => {
      // Find the user's personal calendar first, fall back to org default
      let calendar = await prisma.calendar.findFirst({
        where: { isActive: true, calendarType: 'PERSONAL' as any, createdById: ctx.userId },
        select: { id: true },
      })
      if (!calendar) {
        calendar = await prisma.calendar.findFirst({
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        })
      }
      if (!calendar) throw new Error('No calendar found. Please create a calendar first.')

      const { can } = await import('@/lib/auth/permissions')
      const canPublish = await can(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_APPROVE)

      const event = await createCalendarEvent({
        calendarId: calendar.id,
        title: String(payload.title || ''),
        description: String(payload.description || '') || undefined,
        locationText: String(payload.room || '') || undefined,
        startTime: new Date(ensureISODate(String(payload.startsAt))),
        endTime: new Date(ensureISODate(String(payload.endsAt))),
      }, ctx.userId, canPublish)
      return { message: `Event created: "${event.title}" on ${new Date(event.startTime).toLocaleDateString('en-US', { dateStyle: 'medium' })}` }
    },
  },

  update_event: {
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
    execute: async (payload, ctx) => {
      const { updateEvent } = await import('@/lib/services/calendarService')
      const data: Record<string, unknown> = {}
      if (payload.title) data.title = String(payload.title)
      if (payload.startsAt) data.startsAt = ensureISODate(String(payload.startsAt))
      if (payload.endsAt) data.endsAt = ensureISODate(String(payload.endsAt))
      if (payload.room) data.location = String(payload.room)
      if (payload.description) data.description = String(payload.description)
      await updateEvent(String(payload.eventId), data as any, 'this' as any, ctx.userId)
      return { message: `Event updated.` }
    },
  },

  cancel_event: {
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_DELETE_ALL,
    execute: async (payload) => {
      const { deleteEvent } = await import('@/lib/services/calendarService')
      await deleteEvent(String(payload.eventId))
      return { message: `Event cancelled.` }
    },
  },

  submit_event_for_approval: {
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_CREATE,
    execute: async (payload, ctx) => {
      const { submitForApproval } = await import('@/lib/services/calendarService')
      await submitForApproval(String(payload.eventId), ctx.userId)
      return { message: `Event submitted for approval.` }
    },
  },

  approve_event: {
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_APPROVE,
    execute: async (payload, ctx) => {
      const { approveEvent } = await import('@/lib/services/calendarService')
      await approveEvent(String(payload.eventId), String(payload.channel || 'admin') as any, ctx.userId)
      return { message: `Event approved.` }
    },
  },

  reject_event: {
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_APPROVE,
    execute: async (payload, ctx) => {
      const { rejectEvent } = await import('@/lib/services/calendarService')
      await rejectEvent(String(payload.eventId), String(payload.channel || 'admin') as any, ctx.userId, String(payload.reason || ''))
      return { message: `Event rejected.` }
    },
  },

  // ── IT ─────────────────────────────────────────────────────────────────
  create_it_ticket: {
    requiredPermission: PERMISSIONS.IT_TICKET_SUBMIT,
    execute: async (payload, ctx) => {
      const { createITTicket } = await import('@/lib/services/itTicketService')
      const ticket = await createITTicket({
        title: String(payload.title || ''),
        description: String(payload.description || '') || undefined,
        issueType: String(payload.issueType || 'OTHER') as any,
        priority: String(payload.priority || 'MEDIUM') as any,
        photos: [],
      }, ctx.userId, ctx.organizationId)
      return { message: `IT ticket ${(ticket as any).ticketNumber || ''} created: "${(ticket as any).title}"` }
    },
  },

  update_it_ticket_status: {
    requiredPermission: PERMISSIONS.IT_TICKET_UPDATE_STATUS,
    execute: async (payload, ctx) => {
      const { transitionITTicketStatus } = await import('@/lib/services/itTicketService')
      await transitionITTicketStatus(String(payload.ticketId), String(payload.newStatus) as any, { comment: String(payload.note || '') }, { userId: ctx.userId, orgId: ctx.organizationId })
      return { message: `IT ticket ${payload.ticketNumber || ''} updated to ${payload.newStatus}.` }
    },
  },

  assign_it_ticket: {
    requiredPermission: PERMISSIONS.IT_TICKET_ASSIGN,
    execute: async (payload, ctx) => {
      const { assignITTicket } = await import('@/lib/services/itTicketService')
      await assignITTicket(String(payload.ticketId), String(payload.assigneeId), { userId: ctx.userId, orgId: ctx.organizationId })
      return { message: `IT ticket ${payload.ticketNumber || ''} assigned to ${payload.assigneeName || 'user'}.` }
    },
  },

  // ── Users ──────────────────────────────────────────────────────────────
  invite_user: {
    requiredPermission: PERMISSIONS.USERS_INVITE,
    execute: async (payload, ctx) => {
      const role = await prisma.role.findFirst({ where: { slug: String(payload.role || 'member') }, select: { id: true } })
      const user = await prisma.user.create({
        data: {
          name: String(payload.name || ''),
          email: String(payload.email || ''),
          organizationId: ctx.organizationId,
          status: 'INVITED' as any,
          ...(role ? { roleId: role.id } : {}),
        },
        select: { name: true, email: true },
      })
      return { message: `Invited ${user.name} (${user.email}).` }
    },
  },

  update_user_role: {
    requiredPermission: PERMISSIONS.USERS_MANAGE_ROLES,
    execute: async (payload) => {
      await prisma.user.update({
        where: { id: String(payload.userId) },
        data: { roleId: String(payload.roleId) },
      })
      clearPermissionCache(String(payload.userId))
      return { message: `${payload.userName}'s role changed to ${payload.newRoleName}.` }
    },
  },

  deactivate_user: {
    requiredPermission: PERMISSIONS.USERS_UPDATE,
    execute: async (payload) => {
      await prisma.user.delete({ where: { id: String(payload.userId) } }) // soft-delete via extension
      return { message: `${payload.userName}'s account has been deactivated.` }
    },
  },

  // ── Inventory ──────────────────────────────────────────────────────────
  create_inventory_item: {
    requiredPermission: PERMISSIONS.INVENTORY_CREATE,
    execute: async (payload, ctx) => {
      const { createItem } = await import('@/lib/services/inventoryService')
      const item = await createItem(ctx.organizationId, {
        name: String(payload.name || ''),
        category: String(payload.category || ''),
        quantityOnHand: Number(payload.quantityOnHand) || 0,
        reorderThreshold: Number(payload.reorderThreshold) || 5,
      } as any)
      return { message: `Inventory item "${(item as any).name}" created.` }
    },
  },

  update_inventory_item: {
    requiredPermission: PERMISSIONS.INVENTORY_UPDATE,
    execute: async (payload, ctx) => {
      const { updateItem } = await import('@/lib/services/inventoryService')
      const data: Record<string, unknown> = {}
      if (payload.name) data.name = String(payload.name)
      if (payload.category) data.category = String(payload.category)
      if (payload.quantityOnHand !== undefined) data.quantityOnHand = Number(payload.quantityOnHand)
      if (payload.reorderThreshold !== undefined) data.reorderThreshold = Number(payload.reorderThreshold)
      await updateItem(ctx.organizationId, String(payload.itemId), data as any)
      return { message: `Inventory item "${payload.itemName || ''}" updated.` }
    },
  },

  // ── Campus ─────────────────────────────────────────────────────────────
  create_building: {
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    execute: async (payload, ctx) => {
      const building = await prisma.building.create({
        data: { name: String(payload.name || ''), address: String(payload.address || '') || undefined, organizationId: ctx.organizationId } as any,
        select: { name: true },
      })
      return { message: `Building "${building.name}" created.` }
    },
  },

  update_building: {
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    execute: async (payload) => {
      const data: Record<string, unknown> = {}
      if (payload.name) data.name = String(payload.name)
      if (payload.address) data.address = String(payload.address)
      await prisma.building.update({ where: { id: String(payload.buildingId) }, data: data as any })
      return { message: `Building updated.` }
    },
  },

  create_room: {
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    execute: async (payload, ctx) => {
      const room = await prisma.room.create({
        data: {
          roomNumber: String(payload.roomNumber || ''),
          displayName: String(payload.displayName || '') || undefined,
          buildingId: String(payload.buildingId),
          organizationId: ctx.organizationId,
        } as any,
        select: { roomNumber: true, displayName: true },
      })
      return { message: `Room ${room.displayName || room.roomNumber} created in ${payload.buildingName || 'building'}.` }
    },
  },

  update_room: {
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    execute: async (payload) => {
      const data: Record<string, unknown> = {}
      if (payload.roomNumber) data.roomNumber = String(payload.roomNumber)
      if (payload.displayName) data.displayName = String(payload.displayName)
      await prisma.room.update({ where: { id: String(payload.roomId) }, data: data as any })
      return { message: `Room updated.` }
    },
  },

  // ── Communication ──────────────────────────────────────────────────────
  send_email: {
    requiredPermission: PERMISSIONS.USERS_INVITE,
    execute: async (payload) => {
      const { sendContactFormEmail } = await import('@/lib/services/emailService')
      await sendContactFormEmail({
        name: String(payload.recipientName || 'Leo (AI Assistant)'),
        email: String(payload.recipientEmail || ''),
        subject: String(payload.subject || ''),
        message: String(payload.message || ''),
      })
      return { message: `Email sent to ${payload.recipientName}.` }
    },
  },
}

/**
 * Execute a confirmed action by name.
 */
export async function executeAction(
  actionName: string,
  payload: Record<string, unknown>,
  ctx: ActionContext
): Promise<{ message: string }> {
  const handler = ACTION_HANDLERS[actionName]
  if (!handler) {
    throw new Error(`Unknown action: ${actionName}`)
  }

  await assertCan(ctx.userId, handler.requiredPermission)
  return handler.execute(payload, ctx)
}
