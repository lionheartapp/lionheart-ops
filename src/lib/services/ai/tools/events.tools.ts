/**
 * AI Assistant — Events Domain Tools
 *
 * Existing: list_upcoming_events, create_event, check_room_availability, find_available_rooms
 * New:      check_user_availability, update_event, cancel_event, submit_event_for_approval,
 *           approve_event, reject_event, manage_event_attendees
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { prisma } from '@/lib/db'
import type { RichConfirmationCardData } from '@/lib/types/assistant'
import { PERMISSIONS } from '@/lib/permissions'
import { checkRoomConflict } from '@/lib/services/eventService'
import { getTimezoneOffset, getOrgTimezone, formatInTimezone, getOrgToday } from '@/lib/utils/timezone'

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: List Calendars ──────────────────────────────────────────────
  list_calendars: {
    definition: {
      name: 'list_calendars',
      description: 'List all active calendars for the organization. Use this before creating events to know which calendars are available (e.g. School Calendar, Staff Calendar, Personal).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async () => {
      const calendars = await prisma.calendar.findMany({
        where: { isActive: true },
        select: { id: true, name: true, calendarType: true, color: true },
        orderBy: { name: 'asc' },
      })

      return JSON.stringify({
        calendars: calendars.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.calendarType,
          color: c.color,
        })),
        count: calendars.length,
      })
    },
  },

  // ── GREEN: List Upcoming Events ──────────────────────────────────────────
  list_upcoming_events: {
    definition: {
      name: 'list_upcoming_events',
      description: 'List upcoming calendar events for the organization. Can also search for events by title. Returns event title, date, time, location, and status.',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: { type: 'number', description: 'Number of days ahead to look (default: 14, max: 90)' },
          limit: { type: 'number', description: 'Max events to return (default: 10)' },
          search: { type: 'string', description: 'Search events by title (optional). Use this when looking for a specific event.' },
          date: { type: 'string', description: 'Specific date to look up in YYYY-MM-DD format (optional). Overrides days_ahead.' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const limit = Math.min((input.limit as number) || 10, 25)
      const searchQuery = input.search ? String(input.search).trim() : ''
      const specificDate = input.date ? String(input.date).trim() : ''

      let rangeStart: Date
      let rangeEnd: Date

      if (specificDate) {
        // Look at the specific date (full day)
        rangeStart = new Date(specificDate + 'T00:00:00')
        rangeEnd = new Date(specificDate + 'T23:59:59')
      } else {
        const daysAhead = Math.min((input.days_ahead as number) || 14, 90)
        rangeStart = new Date()
        rangeEnd = new Date(rangeStart.getTime() + daysAhead * 24 * 60 * 60 * 1000)
      }

      // Query CalendarEvent (current model)
      const calWhere: Record<string, unknown> = {
        calendarStatus: { not: 'CANCELLED' as any },
        startTime: { lte: rangeEnd },
        endTime: { gte: rangeStart },
      }
      if (searchQuery) {
        calWhere.title = { contains: searchQuery, mode: 'insensitive' }
      }

      const calEvents = await prisma.calendarEvent.findMany({
        where: calWhere as any,
        select: {
          id: true, title: true, startTime: true, endTime: true,
          locationText: true, calendarStatus: true,
          calendar: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
        take: limit,
      }).catch(() => [] as any[])

      // Also check legacy Event table
      const legacyWhere: Record<string, unknown> = {
        status: { not: 'CANCELLED' },
        startsAt: { lte: rangeEnd },
        endsAt: { gte: rangeStart },
      }
      if (searchQuery) {
        legacyWhere.title = { contains: searchQuery, mode: 'insensitive' }
      }

      const legacyEvents = await prisma.event.findMany({
        where: legacyWhere as any,
        select: { id: true, title: true, startsAt: true, endsAt: true, room: true, status: true },
        orderBy: { startsAt: 'asc' },
        take: limit,
      }).catch(() => [] as any[])

      // Merge and sort
      const merged = [
        ...calEvents.map((e: any) => ({
          id: e.id, title: e.title, start: e.startTime, end: e.endTime,
          location: e.locationText, status: e.calendarStatus, calendar: e.calendar?.name,
        })),
        ...legacyEvents.map((e: any) => ({
          id: e.id, title: e.title, start: e.startsAt, end: e.endsAt,
          location: e.room, status: e.status, calendar: undefined,
        })),
      ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
       .slice(0, limit)

      const periodLabel = specificDate
        ? specificDate
        : `Next ${input.days_ahead || 14} days`

      return JSON.stringify({
        events: merged,
        count: merged.length,
        period: periodLabel,
        ...(searchQuery ? { searchQuery } : {}),
      })
    },
  },

  // ── GREEN: Check Room Availability ───────────────────────────────────────
  check_room_availability: {
    definition: {
      name: 'check_room_availability',
      description: 'Check if a specific room is available for a date and time range.',
      parameters: {
        type: 'object',
        properties: {
          room_name: { type: 'string', description: 'Room name or number to check (e.g. "Gym", "Room 101")' },
          start_datetime: { type: 'string', description: 'Start date/time in ISO format' },
          end_datetime: { type: 'string', description: 'End date/time in ISO format' },
        },
        required: ['room_name', 'start_datetime', 'end_datetime'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const roomName = String(input.room_name || '')
      const startStr = String(input.start_datetime || '')
      const endStr = String(input.end_datetime || '')
      if (!roomName || !startStr || !endStr) return JSON.stringify({ error: 'Room name, start time, and end time are all required.' })

      const startDt = new Date(startStr)
      const endDt = new Date(endStr)
      const orgTz = await getOrgTimezone(ctx.organizationId)
      const timeFmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }

      // Check CalendarEvent table (current model) first
      try {
        const calConflict = await prisma.calendarEvent.findFirst({
          where: {
            locationText: { equals: roomName, mode: 'insensitive' },
            calendarStatus: { not: 'CANCELLED' as any },
            startTime: { lt: endDt },
            endTime: { gt: startDt },
          },
          select: { id: true, title: true, startTime: true, endTime: true },
        })
        if (calConflict) {
          const conflictMsg = `Room "${roomName}" is already booked from ${formatInTimezone(calConflict.startTime, orgTz, timeFmt)} to ${formatInTimezone(calConflict.endTime, orgTz, timeFmt)} ("${calConflict.title}")`
          return JSON.stringify({ available: false, room: roomName, conflict: conflictMsg, message: `${roomName} is not available -- ${conflictMsg}` })
        }
      } catch { /* Fall through to legacy check */ }

      // Also check legacy Event table
      try {
        await checkRoomConflict(roomName, startDt, endDt)
        return JSON.stringify({ available: true, room: roomName, start: startStr, end: endStr, message: `${roomName} is available for that time.` })
      } catch (err: any) {
        if (err.code === 'ROOM_CONFLICT') {
          return JSON.stringify({ available: false, room: roomName, conflict: err.message, message: `${roomName} is not available -- ${err.message}` })
        }
        return JSON.stringify({ error: `Failed to check room availability: ${err.message}` })
      }
    },
  },

  // ── GREEN: Find Available Rooms ──────────────────────────────────────────
  find_available_rooms: {
    definition: {
      name: 'find_available_rooms',
      description: 'Find rooms matching criteria like capacity or campus. Lists rooms without checking time-slot availability.',
      parameters: {
        type: 'object',
        properties: {
          min_capacity: { type: 'number', description: 'Minimum room capacity needed (optional)' },
          building_name: { type: 'string', description: 'Filter by building name (optional)' },
          limit: { type: 'number', description: 'Max results to return (default: 10)' },
        },
        required: [],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input) => {
      const buildingName = input.building_name as string | undefined
      const limit = Math.min((input.limit as number) || 10, 25)
      const where: Record<string, unknown> = {}
      if (buildingName) where.building = { name: { contains: buildingName, mode: 'insensitive' } }

      const rooms = await prisma.room.findMany({
        where,
        select: { id: true, roomNumber: true, displayName: true, building: { select: { name: true } } },
        orderBy: { roomNumber: 'asc' },
        take: limit,
      })

      return JSON.stringify({
        rooms: rooms.map(r => ({ name: r.displayName || r.roomNumber, number: r.roomNumber, building: r.building?.name })),
        count: rooms.length,
      })
    },
  },

  // ── GREEN: Check User Availability ───────────────────────────────────────
  check_user_availability: {
    definition: {
      name: 'check_user_availability',
      description: 'Check a user\'s calendar availability for a date or date range. Returns their busy time slots. Use when scheduling meetings — check each participant\'s availability to find overlapping free time.',
      parameters: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Name or email of the user to check' },
          date: { type: 'string', description: 'Single date in YYYY-MM-DD format (checks full day)' },
          start_date: { type: 'string', description: 'Range start in YYYY-MM-DD format (optional, use with end_date)' },
          end_date: { type: 'string', description: 'Range end in YYYY-MM-DD format (optional, use with start_date)' },
        },
        required: ['user_name'],
      },
    },
    requiredPermission: PERMISSIONS.CALENDAR_EVENTS_READ,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const userName = String(input.user_name || '')
      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: userName, mode: 'insensitive' } }, { email: { contains: userName, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${userName}"` })

      // Use org timezone for correct day boundaries
      const orgTz = await getOrgTimezone(ctx.organizationId)
      const tzOffset = getTimezoneOffset(orgTz)

      const singleDate = input.date as string | undefined
      let start: Date, end: Date
      if (singleDate) {
        start = new Date(singleDate + 'T00:00:00' + tzOffset)
        end = new Date(singleDate + 'T23:59:59' + tzOffset)
      } else {
        const todayStr = getOrgToday(orgTz).dateStr
        const startStr = (input.start_date as string) || todayStr
        const endStr = (input.end_date as string) || startStr
        start = new Date(startStr + 'T00:00:00' + tzOffset)
        end = new Date(endStr + 'T23:59:59' + tzOffset)
      }

      const { getEventsForUser } = await import('@/lib/services/calendarService')
      const events = await getEventsForUser(user.id, start, end)

      const busySlots = events.map((e: any) => ({
        title: e.title,
        start: e.startsAt || e.start,
        end: e.endsAt || e.end,
      }))

      return JSON.stringify({
        user: { name: user.name, email: user.email },
        period: { start: start.toISOString(), end: end.toISOString() },
        busySlots,
        busyCount: busySlots.length,
        message: busySlots.length === 0
          ? `${user.name} has no events during this period — they're free!`
          : `${user.name} has ${busySlots.length} event(s) during this period.`,
      })
    },
  },

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
          end_date: { type: 'string', description: 'End date and time in ISO format (e.g. "2026-03-15T15:00:00")' },
          location: { type: 'string', description: 'Room or location name (optional)' },
          attendees: { type: 'string', description: 'Comma-separated names of people to invite (from @mentions)' },
          calendar_id: { type: 'string', description: 'ID of the calendar to create the event on (from list_calendars). Must provide this or calendar_name.' },
          calendar_name: { type: 'string', description: 'Name of the calendar to create the event on (e.g. "School Calendar", "Staff Calendar"). Will be fuzzy-matched against active calendars. Must provide this or calendar_id.' },
          equipment_list: { type: 'string', description: 'JSON array of equipment/setup items, e.g. [{"item":"Vocal Microphones","quantity":4},{"item":"Projector","quantity":1}]. Use this when the user describes setup requirements.' },
        },
        required: ['title', 'start_date', 'end_date'],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_CREATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      let calendarId = input.calendar_id ? String(input.calendar_id) : undefined
      const calendarNameInput = input.calendar_name ? String(input.calendar_name).trim() : undefined
      const equipmentListStr = input.equipment_list ? String(input.equipment_list) : undefined

      // Parse equipment list if provided
      let equipmentList: Array<{ item: string; quantity: number }> | undefined
      if (equipmentListStr) {
        try {
          const parsed = JSON.parse(equipmentListStr)
          if (Array.isArray(parsed)) {
            equipmentList = parsed.map((e: any) => ({
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
          let match = calendars.find((c: any) =>
            c.name.toLowerCase() === calendarNameInput.toLowerCase()
          )
          // Then try partial/fuzzy match
          if (!match) {
            const needle = calendarNameInput.toLowerCase()
            match = calendars.find((c: any) =>
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
          const calendarList = calendars.map((c: any) => `- "${c.name}" (${c.calendarType}, id: ${c.id})`).join('\n')
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

      const draft: Record<string, unknown> = {
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
      const startDisplay = startDate
        ? startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' \u2022 ' +
          startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'Not set'
      const endDisplay = endDate
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
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
              calendarStatus: { not: 'CANCELLED' as any },
              startTime: { lt: endDate },
              endTime: { gt: startDate },
            },
            select: { id: true, title: true, startTime: true, endTime: true },
          }).catch(() => null)

          if (calConflict) {
            const cStart = new Date(calConflict.startTime)
            const cTime = cStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
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
              const lStart = new Date(legacyConflict.startsAt)
              const lTime = lStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
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
