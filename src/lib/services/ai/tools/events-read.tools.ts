/**
 * AI Assistant — Events Domain Tools (GREEN / Read-Only)
 *
 * list_calendars, get_event_details, list_upcoming_events,
 * check_room_availability, find_available_rooms,
 * check_user_availability, search_past_events,
 * check_event_equipment_availability
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { checkRoomConflict } from '@/lib/services/eventService'
import { getTimezoneOffset, getOrgTimezone, formatInTimezone, getOrgToday } from '@/lib/utils/timezone'

/** Loose record type that allows nested property access on dynamic Prisma results. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynRecord = Record<string, any>

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
        calendars: calendars.map((c: DynRecord) => ({
          id: c.id,
          name: c.name,
          type: c.calendarType,
          color: c.color,
        })),
        count: calendars.length,
      })
    },
  },

  // ── GREEN: Get Event Details ─────────────────────────────────────────────
  get_event_details: {
    definition: {
      name: 'get_event_details',
      description: 'Get full details for a specific calendar event by ID. Returns description, attendees, equipment/resource requests, approval status, and all metadata.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID to look up' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const eventId = String(input.event_id || '')
      if (!eventId) return JSON.stringify({ error: 'event_id is required.' })

      const event = await prisma.calendarEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true, title: true, description: true, startTime: true, endTime: true,
          timezone: true, isAllDay: true, locationText: true, calendarStatus: true,
          metadata: true, rrule: true,
          calendar: { select: { name: true, calendarType: true } },
          createdBy: { select: { name: true, email: true } },
          approvedBy: { select: { name: true } },
          attendees: { select: { user: { select: { name: true, email: true } }, responseStatus: true } },
          resourceRequests: { select: { resourceType: true, requestStatus: true, details: true, responseNote: true } },
          building: { select: { name: true } },
          space: { select: { name: true } },
          category: { select: { name: true } },
        },
      }).catch(() => null)

      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const meta = event.metadata as DynRecord | null
      const equipmentList = meta?.equipmentList as Array<{ item: string; quantity: number }> | undefined

      return JSON.stringify({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        start: event.startTime,
        end: event.endTime,
        timezone: event.timezone,
        isAllDay: event.isAllDay,
        location: event.locationText || undefined,
        building: (event as DynRecord).building?.name || undefined,
        space: (event as DynRecord).space?.name || undefined,
        status: event.calendarStatus,
        calendar: (event as DynRecord).calendar?.name,
        calendarType: (event as DynRecord).calendar?.calendarType,
        category: (event as DynRecord).category?.name || undefined,
        createdBy: (event as DynRecord).createdBy?.name || undefined,
        approvedBy: (event as DynRecord).approvedBy?.name || undefined,
        recurrence: event.rrule || undefined,
        attendees: (event as DynRecord).attendees?.map((a: DynRecord) => ({
          name: a.user?.name,
          email: a.user?.email,
          rsvp: a.responseStatus,
        })) || [],
        equipmentList: equipmentList && equipmentList.length > 0 ? equipmentList : undefined,
        resourceRequests: (event as DynRecord).resourceRequests?.map((r: DynRecord) => ({
          type: r.resourceType,
          status: r.requestStatus,
          details: r.details,
          note: r.responseNote || undefined,
        })) || [],
      })
    },
  },

  // ── GREEN: List Upcoming Events ──────────────────────────────────────────
  list_upcoming_events: {
    definition: {
      name: 'list_upcoming_events',
      description: 'List upcoming calendar events for the organization. Can also search for events by title. Returns full event details including description, attendees, equipment lists, AV/resource requests, and who created each event. Use this to answer questions about event logistics, AV needs, attendees, etc.',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: { type: 'number', description: 'Number of days ahead to look (default: 14, max: 90)' },
          limit: { type: 'number', description: 'Max events to return (default: 10)' },
          search: { type: 'string', description: 'Search events by title (optional). Use this when looking for a specific event.' },
          date: { type: 'string', description: 'Specific date to look up in YYYY-MM-DD format (optional). Overrides days_ahead.' },
          location: { type: 'string', description: 'Filter events by location/room/building name (case-insensitive match)' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_READ,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const limit = Math.min((input.limit as number) || 25, 50)
      const searchQuery = input.search ? String(input.search).trim() : ''
      const specificDate = input.date ? String(input.date).trim() : ''

      // Use org timezone for correct day boundaries
      const orgTz = await getOrgTimezone(ctx.organizationId)
      const tzOffset = getTimezoneOffset(orgTz)

      let rangeStart: Date
      let rangeEnd: Date

      if (specificDate) {
        rangeStart = new Date(specificDate + 'T00:00:00' + tzOffset)
        rangeEnd = new Date(specificDate + 'T23:59:59' + tzOffset)
      } else {
        const daysAhead = Math.min((input.days_ahead as number) || 14, 90)
        rangeStart = new Date()
        rangeEnd = new Date(rangeStart.getTime() + daysAhead * 24 * 60 * 60 * 1000)
      }

      // Get all active calendars for the org (same as calendar UI)
      const calendars = await prisma.calendar.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      const calendarIds = calendars.map((c: DynRecord) => c.id)

      // Use getEventsInRange from calendarService — handles recurring event expansion
      const { getEventsInRange } = await import('@/lib/services/calendarService')
      let allEvents: Array<DynRecord> = []
      if (calendarIds.length > 0) {
        allEvents = await getEventsInRange(calendarIds, rangeStart, rangeEnd, {
          take: limit * 2, // Fetch extra to account for post-filtering
        })
      }

      // Filter out cancelled events
      allEvents = allEvents.filter((e: DynRecord) => e.calendarStatus !== 'CANCELLED')

      // Apply location filter if provided (match locationText, building name, space name)
      const locationQuery = input.location ? String(input.location).trim() : ''
      if (locationQuery) {
        const locNeedle = locationQuery.toLowerCase()
        allEvents = allEvents.filter((e: DynRecord) =>
          (e.locationText || '').toLowerCase().includes(locNeedle) ||
          (e.building?.name || '').toLowerCase().includes(locNeedle) ||
          (e.space?.name || '').toLowerCase().includes(locNeedle)
        )
      }

      // Apply search filter if provided (search title + description)
      if (searchQuery) {
        const needle = searchQuery.toLowerCase()
        allEvents = allEvents.filter((e: DynRecord) =>
          (e.title || '').toLowerCase().includes(needle) ||
          (e.description || '').toLowerCase().includes(needle)
        )
      }

      // Fetch resource requests for matched events (not included by getEventsInRange)
      const eventIds = allEvents.map((e: DynRecord) => e.id).filter(Boolean)
      const resourceRequests = eventIds.length > 0
        ? await prisma.eventResourceRequest.findMany({
            where: { eventId: { in: eventIds } },
            select: { eventId: true, resourceType: true, requestStatus: true, details: true },
          }).catch(() => [] as Array<DynRecord>)
        : []
      const requestsByEvent = new Map<string, any[]>()
      for (const r of resourceRequests) {
        const list = requestsByEvent.get(r.eventId) || []
        list.push({ type: r.resourceType, status: r.requestStatus, details: r.details })
        requestsByEvent.set(r.eventId, list)
      }

      // Map to output format
      const merged = allEvents.slice(0, limit).map((e: DynRecord) => {
        const meta = e.metadata as DynRecord | null
        const equipmentList = meta?.equipmentList as Array<{ item: string; quantity: number }> | undefined
        const attendeeNames = (e.attendees || []).map((a: DynRecord) => a.user?.name || a.user?.firstName).filter(Boolean)
        const evtResources = requestsByEvent.get(e.id) || []
        const hasAV = evtResources.some((r: DynRecord) => r.type === 'AV_EQUIPMENT') ||
          (equipmentList || []).some((eq: DynRecord) => /mic|speaker|projector|screen|sound|av|audio|video/i.test(eq.item))

        return {
          id: e.id, title: e.title, description: e.description || undefined,
          start: e.startTime, end: e.endTime,
          location: e.locationText, status: e.calendarStatus,
          calendar: e.calendar?.name,
          createdBy: e.createdBy?.name || e.createdBy?.firstName || undefined,
          attendees: attendeeNames.length > 0 ? attendeeNames : undefined,
          equipmentList: equipmentList && equipmentList.length > 0 ? equipmentList : undefined,
          resourceRequests: evtResources.length > 0 ? evtResources : undefined,
          hasAV,
          isRecurring: !!e.rrule,
        }
      })

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
            calendarStatus: { not: 'CANCELLED' },
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
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        if (e.code === 'ROOM_CONFLICT') {
          return JSON.stringify({ available: false, room: roomName, conflict: e.message, message: `${roomName} is not available -- ${e.message}` })
        }
        return JSON.stringify({ error: `Failed to check room availability: ${e.message}` })
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
      const where: DynRecord = {}
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
      description: 'Check a user\'s calendar availability for a date or date range. Returns their busy time slots from ALL calendars including personal calendars. Also finds events that mention the user by name in the title. Use when scheduling meetings — check each participant\'s availability to find overlapping free time.',
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
      const formalEvents = await getEventsForUser(user.id, start, end)

      // Also find events on ANY calendar (including personal calendars) that
      // mention this user by name in the title — catches informal references
      // like "Meeting with Tom Riddle" where Tom wasn't added as a formal attendee.
      const formalIds = new Set(formalEvents.map((e: DynRecord) => e.id))
      const nameParts = (user.name || '').split(' ').filter((p: string) => p.length > 2)
      let nameMatchEvents: Array<DynRecord> = []
      if (nameParts.length > 0) {
        const nameMatches = await prisma.calendarEvent.findMany({
          where: {
            calendarStatus: { in: ['CONFIRMED', 'TENTATIVE', 'PENDING_APPROVAL'] },
            parentEventId: null,
            deletedAt: null,
            title: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' },
            OR: [
              { rrule: null, startTime: { lte: end }, endTime: { gte: start } },
              { rrule: { not: null } },
            ],
          },
          select: { id: true, title: true, startTime: true, endTime: true, calendar: { select: { name: true, calendarType: true } } },
        })
        // Only add events not already found via formal attendee/creator query
        nameMatchEvents = nameMatches.filter((e: DynRecord) => !formalIds.has(e.id))
      }

      const allEvents = [...formalEvents, ...nameMatchEvents]
      const busySlots = allEvents.map((e: DynRecord) => ({
        title: e.title,
        start: e.startTime,
        end: e.endTime,
        calendar: e.calendar?.name || undefined,
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

  // ── GREEN: Search Past Events ───────────────────────────────────────────
  search_past_events: {
    definition: {
      name: 'search_past_events',
      description:
        'Search historical/past events (up to 365 days back). Use when users ask about events that already happened — "what happened last month?", "show me events from January", "did we have a concert last spring?"',
      parameters: {
        type: 'object',
        properties: {
          days_back: { type: 'number', description: 'Number of days to look back (default: 30, max: 365)' },
          search: { type: 'string', description: 'Search events by title (optional)' },
          location: { type: 'string', description: 'Filter by location/room/building name (optional)' },
          limit: { type: 'number', description: 'Max events to return (default: 15, max: 50)' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_READ,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const daysBack = Math.min((input.days_back as number) || 30, 365)
      const limit = Math.min((input.limit as number) || 15, 50)
      const searchQuery = input.search ? String(input.search).trim() : ''
      const locationQuery = input.location ? String(input.location).trim() : ''

      const orgTz = await getOrgTimezone(ctx.organizationId)
      const now = new Date()
      const rangeStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)

      // Get all active calendars
      const calendars = await prisma.calendar.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      const calendarIds = calendars.map((c: DynRecord) => c.id)

      const { getEventsInRange } = await import('@/lib/services/calendarService')
      let allEvents: Array<DynRecord> = []
      if (calendarIds.length > 0) {
        allEvents = await getEventsInRange(calendarIds, rangeStart, now, {
          take: limit * 3,
        })
      }

      // Filter out cancelled
      allEvents = allEvents.filter((e: DynRecord) => e.calendarStatus !== 'CANCELLED')

      // Apply location filter
      if (locationQuery) {
        const locNeedle = locationQuery.toLowerCase()
        allEvents = allEvents.filter((e: DynRecord) =>
          (e.locationText || '').toLowerCase().includes(locNeedle) ||
          (e.building?.name || '').toLowerCase().includes(locNeedle) ||
          (e.space?.name || '').toLowerCase().includes(locNeedle)
        )
      }

      // Apply search filter
      if (searchQuery) {
        const needle = searchQuery.toLowerCase()
        allEvents = allEvents.filter((e: DynRecord) =>
          (e.title || '').toLowerCase().includes(needle) ||
          (e.description || '').toLowerCase().includes(needle)
        )
      }

      // Sort newest first for past events
      allEvents.sort((a: DynRecord, b: DynRecord) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      )

      const mapped = allEvents.slice(0, limit).map((e: DynRecord) => ({
        id: e.id,
        title: e.title,
        description: e.description || undefined,
        start: e.startTime,
        end: e.endTime,
        location: e.locationText || undefined,
        calendar: e.calendar?.name,
        createdBy: e.createdBy?.name || undefined,
        status: e.calendarStatus,
      }))

      return JSON.stringify({
        events: mapped,
        count: mapped.length,
        period: `Past ${daysBack} days`,
        ...(searchQuery ? { searchQuery } : {}),
      })
    },
  },

  // ── GREEN: Check Event Equipment Availability ─────────────────────────────
  check_event_equipment_availability: {
    definition: {
      name: 'check_event_equipment_availability',
      description:
        'Check whether the equipment listed on an event is available in inventory. Takes an event ID, reads its equipment list from metadata, and fuzzy-matches each item against inventory. Returns availability status per item.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'The event ID to check equipment for' },
        },
        required: ['event_id'],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const eventId = String(input.event_id || '').trim()
      if (!eventId) return JSON.stringify({ error: 'event_id is required.' })

      const event = await prisma.calendarEvent.findUnique({
        where: { id: eventId },
        select: { id: true, title: true, metadata: true },
      }).catch(() => null)

      if (!event) return JSON.stringify({ error: `Event not found: ${eventId}` })

      const meta = event.metadata as DynRecord | null
      const equipmentList = meta?.equipmentList as Array<{ item: string; quantity: number }> | undefined

      if (!equipmentList || equipmentList.length === 0) {
        return JSON.stringify({
          event: event.title,
          message: 'This event has no equipment list in its metadata.',
          items: [],
        })
      }

      // Fuzzy-match each equipment item against inventory
      const results = await Promise.all(
        equipmentList.map(async (eq) => {
          const keywords = eq.item.toLowerCase().split(/\s+/).filter(w => w.length > 2)

          // Try exact-ish match first, then keyword match
          let inventoryItem = await prisma.inventoryItem.findFirst({
            where: { name: { contains: eq.item, mode: 'insensitive' } },
            select: { id: true, name: true, quantityOnHand: true, reorderThreshold: true },
          })

          if (!inventoryItem && keywords.length > 0) {
            inventoryItem = await prisma.inventoryItem.findFirst({
              where: {
                OR: keywords.map(kw => ({ name: { contains: kw, mode: 'insensitive' as const } })),
              },
              select: { id: true, name: true, quantityOnHand: true, reorderThreshold: true },
            })
          }

          if (!inventoryItem) {
            return {
              requested: eq.item,
              quantity: eq.quantity,
              status: 'not_found' as const,
              message: `"${eq.item}" not found in inventory`,
            }
          }

          const available = inventoryItem.quantityOnHand
          const status = available <= 0
            ? 'unavailable' as const
            : available < eq.quantity
              ? 'low' as const
              : available <= inventoryItem.reorderThreshold
                ? 'low' as const
                : 'available' as const

          return {
            requested: eq.item,
            quantity: eq.quantity,
            inventoryName: inventoryItem.name,
            inStock: available,
            status,
            message: status === 'available'
              ? `${available} in stock (${eq.quantity} needed)`
              : status === 'low'
                ? `Only ${available} in stock but ${eq.quantity} needed`
                : `Out of stock (${eq.quantity} needed)`,
          }
        })
      )

      const allGood = results.every(r => r.status === 'available')
      const issues = results.filter(r => r.status !== 'available')

      return JSON.stringify({
        event: event.title,
        items: results,
        allAvailable: allGood,
        issueCount: issues.length,
        summary: allGood
          ? 'All equipment is available!'
          : `${issues.length} item(s) have availability issues.`,
      })
    },
  },
}

registerTools(tools)
