/**
 * AI Assistant — Events Domain Tools (ORANGE / Write Operations)
 *
 * create_event, update_event, submit_event_for_approval,
 * approve_event, reject_event
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { prisma } from '@/lib/db'
import type { RichConfirmationCardData } from '@/lib/types/assistant'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgTimezone, formatInTimezone } from '@/lib/utils/timezone'

/** Loose record type that allows nested property access on dynamic Prisma results. */
// eslint-disable-next-line
type DynRecord = Record<string, any>

const tools: Record<string, ToolRegistryEntry> = {
  // ── ORANGE: Create Event (Draft) ─────────────────────────────────────────
  create_event: {
    definition: {
      name: 'create_event',
      description:
        'Draft a new calendar event. REQUIRED: You must specify either calendar_id or calendar_name. Call list_calendars first if you don\'t know the calendar. Before calling this tool, ask the user about: AV needs, facilities setup, expected attendance, and any special requirements. Only call after the user has confirmed all details or explicitly said to skip follow-up questions.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          description: { type: 'string', description: 'Event description (optional)' },
          start_date: { type: 'string', description: 'Start date and time in ISO format (e.g. "2026-03-15T14:00:00")' },
          end_date: { type: 'string', description: 'End date and time in ISO format (e.g. "2026-03-15T15:00:00"). If omitted, defaults to 1 hour after start.' },
          location: { type: 'string', description: 'Room or location name (optional)' },
          attendees: { type: 'string', description: 'Comma-separated names of people to invite (from @mentions)' },
          calendar_id: { type: 'string', description: 'ID of the calendar to create the event on (from list_calendars). Must provide this or calendar_name.' },
          calendar_name: { type: 'string', description: 'Name of the calendar to create the event on (e.g. "School Calendar", "Staff Calendar"). Will be fuzzy-matched against active calendars. Must provide this or calendar_id.' },
          equipment_list: { type: 'string', description: 'JSON array of equipment/setup items, e.g. [{"item":"Vocal Microphones","quantity":4},{"item":"Projector","quantity":1}]. Use this when the user describes setup requirements.' },
        },
        required: ['title', 'start_date'],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_CREATE,
    riskTier: 'ORANGE',
    execute: async (input, ctx) => {
      // Default end_date to 1 hour after start if not provided
      if (!input.end_date && input.start_date) {
        const start = new Date(String(input.start_date))
        input.end_date = new Date(start.getTime() + 60 * 60 * 1000).toISOString()
      }

      let calendarId = input.calendar_id ? String(input.calendar_id) : undefined
      const calendarNameInput = input.calendar_name ? String(input.calendar_name).trim() : undefined
      const equipmentListStr = input.equipment_list ? String(input.equipment_list) : undefined

      // Parse equipment list if provided
      let equipmentList: Array<{ item: string; quantity: number }> | undefined
      if (equipmentListStr) {
        try {
          const parsed = JSON.parse(equipmentListStr)
          if (Array.isArray(parsed)) {
            equipmentList = parsed.map((e: DynRecord) => ({
              item: String(e.item || e.name || ''),
              quantity: Number(e.quantity || e.qty || 1),
            })).filter(e => e.item)
          }
        } catch { /* Non-critical — equipment stays in description */ }
      }

      // ── Calendar Resolution ─────────────────────────────────────────────
      // Priority: calendar_id > calendar_name (fuzzy match) > error with available list

      // If no calendar_id but calendar_name provided, fuzzy-match against active calendars
      if (!calendarId && calendarNameInput) {
        try {
          const calendars = await prisma.calendar.findMany({
            where: { isActive: true },
            select: { id: true, name: true, calendarType: true },
          })
          // Try exact match first (case-insensitive)
          let match = calendars.find((c: DynRecord) =>
            c.name.toLowerCase() === calendarNameInput.toLowerCase()
          )
          // Then try partial/fuzzy match
          if (!match) {
            const needle = calendarNameInput.toLowerCase()
            match = calendars.find((c: DynRecord) =>
              c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase())
            )
          }
          if (match) {
            calendarId = match.id
          }
        } catch { /* Fall through to no-calendar error */ }
      }

      // If still no calendar specified at all, return an error listing available calendars
      if (!calendarId && !calendarNameInput) {
        try {
          const calendars = await prisma.calendar.findMany({
            where: { isActive: true },
            select: { id: true, name: true, calendarType: true },
            orderBy: { name: 'asc' },
          })
          const calendarList = calendars.map((c: DynRecord) => `- "${c.name}" (${c.calendarType}, id: ${c.id})`).join('\n')
          return JSON.stringify({
            error: true,
            message: `No calendar specified. You must include a calendar_id or calendar_name when creating an event. Ask the user which calendar to use.\n\nAvailable calendars:\n${calendarList}`,
          })
        } catch {
          return JSON.stringify({
            error: true,
            message: 'No calendar specified. You must include a calendar_id or calendar_name when creating an event. Call list_calendars first, then ask the user which calendar to use.',
          })
        }
      }

      // Look up selected calendar name and type
      let calendarName: string | undefined
      let isPersonalCalendar = !calendarId
      if (calendarId) {
        try {
          const cal = await prisma.calendar.findUnique({
            where: { id: calendarId },
            select: { name: true, calendarType: true },
          })
          if (cal) {
            calendarName = cal.name
            isPersonalCalendar = cal.calendarType === 'PERSONAL'
          }
        } catch { /* Non-critical */ }
      }

      const draft: DynRecord = {
        action: 'create_event',
        title: String(input.title || ''),
        description: String(input.description || ''),
        startsAt: String(input.start_date || ''),
        endsAt: String(input.end_date || ''),
        room: String(input.location || ''),
        attendees: String(input.attendees || ''),
      }
      if (calendarId) draft.calendarId = calendarId
      if (calendarName) draft.calendarName = calendarName
      if (equipmentList && equipmentList.length > 0) draft.equipmentList = equipmentList

      const startDate = draft.startsAt ? new Date(draft.startsAt as string) : null
      const endDate = draft.endsAt ? new Date(draft.endsAt as string) : null

      // Use org timezone for display so times match what the user requested
      const orgTz = await getOrgTimezone(ctx.organizationId)
      const startDisplay = startDate
        ? formatInTimezone(startDate, orgTz, { weekday: 'long', month: 'long', day: 'numeric' }) + ' \u2022 ' +
          formatInTimezone(startDate, orgTz, { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'Not set'
      const endDisplay = endDate
        ? formatInTimezone(endDate, orgTz, { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'Not set'

      // Check resource availability from description/title keywords
      let resources: RichConfirmationCardData['resources'] = undefined
      const descLower = ((draft.description as string) + ' ' + (draft.title as string)).toLowerCase()
      const resourceKeywords = ['chair', 'table', 'projector', 'microphone', 'speaker', 'screen', 'laptop', 'whiteboard', 'easel', 'tent', 'podium', 'av setup']
      const matchedKeywords = resourceKeywords.filter(kw => descLower.includes(kw))

      if (matchedKeywords.length > 0) {
        try {
          const items = await prisma.inventoryItem.findMany({
            where: { OR: matchedKeywords.map(kw => ({ name: { contains: kw, mode: 'insensitive' as const } })) },
            select: { name: true, quantityOnHand: true, reorderThreshold: true },
            take: 10,
          })
          if (items.length > 0) {
            resources = items.map(item => ({
              name: item.name,
              requested: 0,
              available: item.quantityOnHand,
              status: item.quantityOnHand <= 0 ? 'unavailable' as const
                : item.quantityOnHand <= item.reorderThreshold ? 'low' as const : 'ok' as const,
            }))
          }
        } catch { /* Non-critical */ }
      }

      // ── Auto-check room conflicts (safety net) ───────────────────────────
      let conflictWarning: string | undefined
      const roomName = (draft.room as string || '').trim()
      if (roomName && startDate && endDate) {
        try {
          // Check CalendarEvent table (current model)
          const calConflict = await prisma.calendarEvent.findFirst({
            where: {
              locationText: { equals: roomName, mode: 'insensitive' },
              calendarStatus: { not: 'CANCELLED' },
              startTime: { lt: endDate },
              endTime: { gt: startDate },
            },
            select: { id: true, title: true, startTime: true, endTime: true },
          }).catch(() => null)

          if (calConflict) {
            const cTime = formatInTimezone(new Date(calConflict.startTime), orgTz, { hour: 'numeric', minute: '2-digit', hour12: true })
            conflictWarning = `"${roomName}" is already booked for "${calConflict.title}" at ${cTime}. You may have a scheduling conflict.`
          } else {
            // Also check legacy Event table
            const legacyConflict = await prisma.event.findFirst({
              where: {
                room: { equals: roomName, mode: 'insensitive' },
                status: { not: 'CANCELLED' },
                startsAt: { lt: endDate },
                endsAt: { gt: startDate },
              },
              select: { id: true, title: true, startsAt: true },
            }).catch(() => null)

            if (legacyConflict) {
              const lTime = formatInTimezone(new Date(legacyConflict.startsAt), orgTz, { hour: 'numeric', minute: '2-digit', hour12: true })
              conflictWarning = `"${roomName}" is already booked for "${legacyConflict.title}" at ${lTime}. You may have a scheduling conflict.`
            }
          }
        } catch { /* Non-critical — don't block event creation */ }
      }

      const richCard: RichConfirmationCardData = {
        title: draft.title as string, startDisplay, endDisplay,
        location: (draft.room as string) || undefined, description: (draft.description as string) || undefined,
        resources,
        attendees: (draft.attendees as string) ? (draft.attendees as string).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        equipmentList,
        calendarName,
        calendarId,
        conflictWarning,
        requiresApproval: !isPersonalCalendar,
      }

      return JSON.stringify({
        confirmationRequired: true,
        message: `I've prepared an event draft. Please review and confirm:`,
        draft,
        richCard,
      })
    },
  },

  // ── ORANGE: Update Event ─────────────────────────────────────────────────
  update_event: {
    definition: {
      name: 'update_event',
      description: 'Update an existing calendar event (title, time, location, description). Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID' },
          title: { type: 'string', description: 'New title (optional)' },
          start_date: { type: 'string', description: 'New start date/time in ISO format (optional)' },
          end_date: { type: 'string', description: 'New end date/time in ISO format (optional)' },
          location: { type: 'string', description: 'New location/room (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      const event = await prisma.calendarEvent?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true } }).catch(() => null)
        ?? await prisma.event?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true } }).catch(() => null)
      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const changes: string[] = []
      if (input.title) changes.push(`Title → "${input.title}"`)
      if (input.start_date) changes.push(`Start → ${input.start_date}`)
      if (input.end_date) changes.push(`End → ${input.end_date}`)
      if (input.location) changes.push(`Location → ${input.location}`)
      if (input.description) changes.push('Description updated')
      if (changes.length === 0) return JSON.stringify({ error: 'No changes specified.' })

      const draft = {
        action: 'update_event',
        eventId: event.id,
        ...(input.title ? { title: String(input.title) } : {}),
        ...(input.start_date ? { startsAt: String(input.start_date) } : {}),
        ...(input.end_date ? { endsAt: String(input.end_date) } : {}),
        ...(input.location ? { room: String(input.location) } : {}),
        ...(input.description ? { description: String(input.description) } : {}),
      }

      return JSON.stringify({
        confirmationRequired: true,
        message: `Update event "${event.title}":\n${changes.map(c => `• ${c}`).join('\n')}`,
        draft,
      })
    },
  },

  // ── ORANGE: Submit Event for Approval ────────────────────────────────────
  submit_event_for_approval: {
    definition: {
      name: 'submit_event_for_approval',
      description: 'Submit a draft calendar event for approval. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID to submit' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_CREATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      const event = await prisma.calendarEvent?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true } }).catch(() => null)
      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const draft = { action: 'submit_event_for_approval', eventId: event.id }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Submit "${event.title}" for approval?`,
        draft,
      })
    },
  },

  // ── ORANGE: Approve Event ────────────────────────────────────────────────
  approve_event: {
    definition: {
      name: 'approve_event',
      description: 'Approve a calendar event that is pending approval.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID to approve' },
          channel: { type: 'string', description: 'Approval channel (e.g. "admin", "av_production")' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_APPROVE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      const event = await prisma.calendarEvent?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true } }).catch(() => null)
      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const draft = { action: 'approve_event', eventId: event.id, channel: String(input.channel || 'admin') }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Approve event "${event.title}"?`,
        draft,
      })
    },
  },

  // ── ORANGE: Reject Event ─────────────────────────────────────────────────
  reject_event: {
    definition: {
      name: 'reject_event',
      description: 'Reject a calendar event that is pending approval.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID to reject' },
          channel: { type: 'string', description: 'Approval channel' },
          reason: { type: 'string', description: 'Reason for rejection' },
        },
        required: ['event_id', 'reason'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_APPROVE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      const event = await prisma.calendarEvent?.findUnique?.({ where: { id: eventId }, select: { id: true, title: true } }).catch(() => null)
      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const draft = { action: 'reject_event', eventId: event.id, channel: String(input.channel || 'admin'), reason: String(input.reason || '') }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Reject event "${event.title}"?\nReason: ${input.reason}`,
        draft,
      })
    },
  },
}

registerTools(tools)
