/**
 * AI Assistant — Events Domain Tools (RED/YELLOW / Destructive & Immediate)
 *
 * cancel_event (RED), manage_event_attendees (YELLOW)
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

/** Loose record type that allows nested property access on dynamic Prisma results. */
// eslint-disable-next-line
type DynRecord = Record<string, any>

const tools: Record<string, ToolRegistryEntry> = {
  // ── RED: Cancel Event ────────────────────────────────────────────────────
  cancel_event: {
    definition: {
      name: 'cancel_event',
      description: 'Cancel/delete a calendar event. This is a destructive action — returns confirmation with warning.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID' },
          reason: { type: 'string', description: 'Reason for cancellation (optional)' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_DELETE_ALL,
    riskTier: 'RED',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      const event = await prisma.calendarEvent?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true, startTime: true } }).catch(() => null)
        ?? await prisma.event?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true, startsAt: true } }).catch(() => null)
      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const draft = { action: 'cancel_event', eventId: event.id, reason: String(input.reason || '') }
      return JSON.stringify({
        confirmationRequired: true,
        riskTier: 'RED',
        riskWarning: `This will cancel "${event.title}". Attendees will be notified. This action cannot be undone.`,
        message: `Cancel event "${event.title}"?`,
        draft,
      })
    },
  },

  // ── YELLOW: Manage Event Attendees ───────────────────────────────────────
  manage_event_attendees: {
    definition: {
      name: 'manage_event_attendees',
      description: 'Add or remove attendees from a calendar event. Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID' },
          add_users: { type: 'string', description: 'Comma-separated names or emails to add as attendees' },
          remove_users: { type: 'string', description: 'Comma-separated names or emails to remove as attendees' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
    riskTier: 'YELLOW',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      const addUsersStr = String(input.add_users || '')
      const removeUsersStr = String(input.remove_users || '')

      const { addAttendees, removeAttendee } = await import('@/lib/services/calendarService')
      const results: string[] = []

      if (addUsersStr) {
        const names = addUsersStr.split(',').map(s => s.trim()).filter(Boolean)
        const userIds: string[] = []
        for (const name of names) {
          const user = await prisma.user.findFirst({
            where: { OR: [{ name: { contains: name, mode: 'insensitive' } }, { email: { contains: name, mode: 'insensitive' } }] },
            select: { id: true, name: true },
          })
          if (user) { userIds.push(user.id); results.push(`Added ${user.name}`) }
          else results.push(`Could not find user "${name}"`)
        }
        if (userIds.length > 0) await addAttendees(eventId, userIds)
      }

      if (removeUsersStr) {
        const names = removeUsersStr.split(',').map(s => s.trim()).filter(Boolean)
        for (const name of names) {
          const user = await prisma.user.findFirst({
            where: { OR: [{ name: { contains: name, mode: 'insensitive' } }, { email: { contains: name, mode: 'insensitive' } }] },
            select: { id: true, name: true },
          })
          if (user) { await removeAttendee(eventId, user.id); results.push(`Removed ${user.name}`) }
          else results.push(`Could not find user "${name}"`)
        }
      }

      return JSON.stringify({
        executed: true,
        message: results.length > 0 ? results.join('; ') : 'No changes made.',
      })
    },
  },
}

registerTools(tools)
