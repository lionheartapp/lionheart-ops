/**
 * Calendar Service — CalendarEvent CRUD & Approval Workflow
 *
 * Event creation, updates (with recurring event 3-mode editing),
 * deletion, approval workflow, and range queries with recurrence expansion.
 */

import { prisma } from '@/lib/db'
import { expandRecurrence } from './recurrenceService'
import { checkLocationConflict, LocationConflictError } from './calendar-core'
import type {
  CalendarEventStatus,
  Prisma,
} from '@prisma/client'

// ─── Types ─────────────────────────────────────────────────────────────

interface CreateEventInput {
  calendarId: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  timezone?: string
  isAllDay?: boolean
  rrule?: string
  categoryId?: string
  locationText?: string
  buildingId?: string | null
  spaceId?: string | null
  metadata?: Record<string, unknown>
}

interface UpdateEventInput {
  title?: string
  description?: string
  startTime?: Date
  endTime?: Date
  timezone?: string
  isAllDay?: boolean
  rrule?: string
  categoryId?: string | null
  locationText?: string
  buildingId?: string | null
  spaceId?: string | null
  metadata?: Record<string, unknown>
}

type EditMode = 'this' | 'thisAndFollowing' | 'all'

// Re-export the conflict error for consumers that import from calendarService
export { LocationConflictError }

// ─── Calendar Event CRUD ───────────────────────────────────────────────

/**
 * Create a calendar event.
 * Status is determined by: publish permission → CONFIRMED, approval required → DRAFT.
 */
export async function createEvent(
  input: CreateEventInput,
  userId: string,
  canPublish: boolean,
  skipConflictCheck = false
) {
  // Check for location conflicts before creating
  if (!skipConflictCheck) {
    const conflict = await checkLocationConflict({
      startTime: input.startTime,
      endTime: input.endTime,
      buildingId: input.buildingId,
      spaceId: input.spaceId,
      locationText: input.locationText,
    })
    if (conflict.hasConflict) {
      throw new LocationConflictError({
        conflictingEventId: conflict.conflictingEvent.id,
        conflictingEventTitle: conflict.conflictingEvent.title,
        conflictingStart: conflict.conflictingEvent.startTime.toISOString(),
        conflictingEnd: conflict.conflictingEvent.endTime.toISOString(),
        bufferMinutes: conflict.bufferMinutes,
        location: conflict.conflictingEvent.location,
      })
    }
  }

  // Look up the calendar to check approval requirements
  const calendar = await prisma.calendar.findUnique({
    where: { id: input.calendarId },
  })

  if (!calendar) {
    throw new Error('Calendar not found')
  }

  const status: CalendarEventStatus = canPublish
    ? 'CONFIRMED'
    : calendar.requiresApproval
      ? 'DRAFT'
      : 'CONFIRMED'

  const event = await (prisma.calendarEvent.create as Function)({
    data: {
      calendarId: input.calendarId,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone || 'America/Chicago',
      isAllDay: input.isAllDay || false,
      calendarStatus: status,
      rrule: input.rrule,
      categoryId: input.categoryId,
      locationText: input.locationText,
      buildingId: input.buildingId,
      spaceId: input.spaceId,
      metadata: input.metadata as Prisma.InputJsonValue,
      createdById: userId,
    },
    include: {
      calendar: { select: { id: true, name: true, color: true, calendarType: true } },
      category: true,
      building: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
    },
  })

  return event
}

/**
 * Count base event records in a date range (does not expand recurring events).
 * Used for pagination metadata on calendar-events list endpoint.
 */
export async function countEventsInRange(
  calendarIds: string[],
  start: Date,
  end: Date,
  filters?: {
    categoryId?: string
    calendarStatus?: CalendarEventStatus[]
    createdById?: string
  }
): Promise<number> {
  const where: Prisma.CalendarEventWhereInput = {
    calendarId: { in: calendarIds },
    OR: [
      { rrule: null, startTime: { lte: end }, endTime: { gte: start } },
      { rrule: { not: null }, parentEventId: null, startTime: { lte: end } },
    ],
    parentEventId: null,
  }

  if (filters?.categoryId) where.categoryId = filters.categoryId
  if (filters?.calendarStatus) where.calendarStatus = { in: filters.calendarStatus }
  if (filters?.createdById) where.createdById = filters.createdById

  return prisma.calendarEvent.count({ where })
}

/**
 * Get events in a date range, expanding recurring events.
 */
export async function getEventsInRange(
  calendarIds: string[],
  start: Date,
  end: Date,
  filters?: {
    categoryId?: string
    calendarStatus?: CalendarEventStatus[]
    createdById?: string
    skip?: number
    take?: number
  }
) {
  const where: Prisma.CalendarEventWhereInput = {
    calendarId: { in: calendarIds },
    OR: [
      // Non-recurring events in range
      {
        rrule: null,
        startTime: { lte: end },
        endTime: { gte: start },
      },
      // Recurring events that could have instances in range
      // Bound by startTime <= end so we don't fetch every recurring event ever created
      {
        rrule: { not: null },
        parentEventId: null, // Only parent events
        startTime: { lte: end },
      },
    ],
    // Exclude exceptions — they're merged by expandRecurrence
    parentEventId: null,
  }

  if (filters?.categoryId) {
    where.categoryId = filters.categoryId
  }
  if (filters?.calendarStatus) {
    where.calendarStatus = { in: filters.calendarStatus }
  }
  if (filters?.createdById) {
    where.createdById = filters.createdById
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      calendar: { select: { id: true, name: true, color: true, calendarType: true, campus: { select: { id: true, name: true } } } },
      category: true,
      building: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
      attendees: {
        include: { user: { select: { id: true, name: true, firstName: true, lastName: true, avatar: true } } },
      },
      exceptions: true,
    },
    orderBy: { startTime: 'asc' },
    ...(filters?.skip !== undefined ? { skip: filters.skip } : {}),
    ...(filters?.take !== undefined ? { take: filters.take } : {}),
  })

  // Expand recurring events
  const allInstances: Array<Record<string, unknown>> = events.flatMap((event) => {
    if (event.rrule) {
      return expandRecurrence(
        {
          ...event,
          exceptions: event.exceptions.map((e) => ({
            ...e,
            originalStart: e.originalStart,
          })),
        },
        start,
        end
      ) as Array<Record<string, unknown>>
    }
    return [{
      ...event,
      parentEventId: null as string | null,
      isException: false,
    }]
  })

  allInstances.sort((a, b) => new Date(a.startTime as string).getTime() - new Date(b.startTime as string).getTime())
  return allInstances
}

/**
 * Update an event with three-mode editing for recurring events.
 */
export async function updateEvent(
  eventId: string,
  data: UpdateEventInput,
  editMode: EditMode,
  userId: string,
  occurrenceStart?: Date,
  skipConflictCheck = false
) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  })

  if (!event) throw new Error('Event not found')

  // Check for location conflicts before updating
  if (!skipConflictCheck) {
    const checkStart = data.startTime || event.startTime
    const checkEnd = data.endTime || event.endTime
    const checkBuildingId = data.buildingId === undefined ? event.buildingId : data.buildingId
    const checkSpaceId = data.spaceId === undefined ? event.spaceId : data.spaceId
    const checkLocationText = data.locationText === undefined ? event.locationText : data.locationText

    const conflict = await checkLocationConflict({
      startTime: checkStart,
      endTime: checkEnd,
      buildingId: checkBuildingId,
      spaceId: checkSpaceId,
      locationText: checkLocationText || undefined,
      excludeEventId: eventId,
    })
    if (conflict.hasConflict) {
      throw new LocationConflictError({
        conflictingEventId: conflict.conflictingEvent.id,
        conflictingEventTitle: conflict.conflictingEvent.title,
        conflictingStart: conflict.conflictingEvent.startTime.toISOString(),
        conflictingEnd: conflict.conflictingEvent.endTime.toISOString(),
        bufferMinutes: conflict.bufferMinutes,
        location: conflict.conflictingEvent.location,
      })
    }
  }

  // Non-recurring or 'all' mode: straightforward update
  if (!event.rrule || editMode === 'all') {
    return prisma.calendarEvent.update({
      where: { id: event.parentEventId || eventId },
      data,
      include: {
        calendar: { select: { id: true, name: true, color: true, calendarType: true } },
        category: true,
      },
    })
  }

  // 'this' mode: create an exception for a specific occurrence
  if (editMode === 'this') {
    // occurrenceStart = the specific occurrence date being modified.
    // Falls back to event.startTime for non-virtual (already-persisted) events.
    const exceptionOriginalStart = occurrenceStart || event.startTime
    // Compute occurrence end time from the parent's duration
    const parentDuration = event.endTime.getTime() - event.startTime.getTime()
    const occurrenceEnd = new Date(exceptionOriginalStart.getTime() + parentDuration)
    return (prisma.calendarEvent.create as Function)({
      data: {
        calendarId: event.calendarId,
        title: data.title || event.title,
        description: data.description ?? event.description,
        startTime: data.startTime || exceptionOriginalStart,
        endTime: data.endTime || occurrenceEnd,
        timezone: data.timezone || event.timezone,
        isAllDay: data.isAllDay ?? event.isAllDay,
        calendarStatus: event.calendarStatus,
        categoryId: data.categoryId === undefined ? event.categoryId : data.categoryId,
        locationText: data.locationText === undefined ? event.locationText : data.locationText,
        buildingId: data.buildingId === undefined ? event.buildingId : data.buildingId,
        spaceId: data.spaceId === undefined ? event.spaceId : data.spaceId,
        metadata: (data.metadata ?? event.metadata) as Prisma.InputJsonValue,
        parentEventId: event.parentEventId || event.id,
        originalStart: exceptionOriginalStart,
        createdById: userId,
      },
      include: {
        calendar: { select: { id: true, name: true, color: true, calendarType: true } },
        category: true,
      },
    })
  }

  // 'thisAndFollowing' mode: split the series
  // Import splitSeries dynamically to avoid circular dependency
  const { splitSeries } = await import('./recurrenceService')
  const parentId = event.parentEventId || event.id

  const parent = await prisma.calendarEvent.findUnique({
    where: { id: parentId },
  })
  if (!parent || !parent.rrule) throw new Error('Parent event not found')

  const { originalRrule, newRrule } = splitSeries(
    parent.rrule,
    data.startTime || event.startTime,
    parent.startTime
  )

  // Update original series with UNTIL
  await prisma.calendarEvent.update({
    where: { id: parentId },
    data: { rrule: originalRrule },
  })

  // Create new series
  return (prisma.calendarEvent.create as Function)({
    data: {
      calendarId: event.calendarId,
      title: data.title || event.title,
      description: data.description ?? event.description,
      startTime: data.startTime || event.startTime,
      endTime: data.endTime || event.endTime,
      timezone: data.timezone || event.timezone,
      isAllDay: data.isAllDay ?? event.isAllDay,
      calendarStatus: event.calendarStatus,
      rrule: newRrule,
      categoryId: data.categoryId === undefined ? event.categoryId : data.categoryId,
      locationText: data.locationText === undefined ? event.locationText : data.locationText,
      buildingId: data.buildingId === undefined ? event.buildingId : data.buildingId,
      spaceId: data.spaceId === undefined ? event.spaceId : data.spaceId,
      metadata: (data.metadata ?? event.metadata) as Prisma.InputJsonValue,
      createdById: userId,
    },
    include: {
      calendar: { select: { id: true, name: true, color: true, calendarType: true } },
      category: true,
    },
  })
}

/**
 * Delete an event with three-mode support for recurring events.
 *
 * - 'this': Create a CANCELLED exception (exdate suppresses virtual occurrence)
 * - 'thisAndFollowing': Add UNTIL to parent rrule, soft-delete affected exceptions
 * - 'all' (or non-recurring): Soft-delete parent + all exceptions
 */
export async function deleteEvent(
  eventId: string,
  editMode: EditMode = 'all',
  occurrenceStart?: Date
) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  })

  if (!event) throw new Error('Event not found')

  // If this CalendarEvent is a bridge to an active EventProject, sync the
  // EventProject status so it doesn't stay "CONFIRMED" while orphaned.
  if (event.sourceModule === 'event-project' && event.sourceId) {
    try {
      const linkedProject = await prisma.eventProject.findUnique({
        where: { id: event.sourceId },
        select: { id: true, status: true },
      })
      if (linkedProject && linkedProject.status === 'CONFIRMED') {
        await prisma.eventProject.update({
          where: { id: linkedProject.id },
          data: { status: 'CANCELLED' },
        })
      }
    } catch {
      // Non-fatal: continue with delete even if sync fails
    }
  }

  // Non-recurring or 'all' mode: soft-delete parent + exceptions
  if (!event.rrule || editMode === 'all') {
    const parentId = event.parentEventId || eventId
    // Soft-delete all exceptions first
    await prisma.calendarEvent.deleteMany({
      where: { parentEventId: parentId },
    })
    // Soft-delete the parent
    return prisma.calendarEvent.delete({ where: { id: parentId } })
  }

  // 'this' mode: create a CANCELLED exception for a specific occurrence
  if (editMode === 'this') {
    const exceptionOriginalStart = occurrenceStart || event.startTime
    const parentDuration = event.endTime.getTime() - event.startTime.getTime()
    const occurrenceEnd = new Date(exceptionOriginalStart.getTime() + parentDuration)

    return (prisma.calendarEvent.create as Function)({
      data: {
        calendarId: event.calendarId,
        title: event.title,
        description: event.description,
        startTime: exceptionOriginalStart,
        endTime: occurrenceEnd,
        timezone: event.timezone,
        isAllDay: event.isAllDay,
        calendarStatus: 'CANCELLED',
        categoryId: event.categoryId,
        locationText: event.locationText,
        buildingId: event.buildingId,
        spaceId: event.spaceId,
        metadata: event.metadata as Prisma.InputJsonValue,
        parentEventId: event.parentEventId || event.id,
        originalStart: exceptionOriginalStart,
        createdById: event.createdById,
      },
    })
  }

  // 'thisAndFollowing' mode: add UNTIL to parent rrule, soft-delete future exceptions
  const { splitSeries } = await import('./recurrenceService')
  const parentId = event.parentEventId || event.id

  const parent = await prisma.calendarEvent.findUnique({
    where: { id: parentId },
  })
  if (!parent || !parent.rrule) throw new Error('Parent event not found')

  const splitDate = occurrenceStart || event.startTime
  const { originalRrule } = splitSeries(parent.rrule, splitDate, parent.startTime)

  // Update parent with UNTIL
  await prisma.calendarEvent.update({
    where: { id: parentId },
    data: { rrule: originalRrule },
  })

  // Soft-delete exceptions on or after the split date
  const exceptions = await prisma.calendarEvent.findMany({
    where: { parentEventId: parentId },
  })
  for (const exc of exceptions) {
    const excDate = exc.originalStart || exc.startTime
    if (excDate >= splitDate) {
      await prisma.calendarEvent.delete({ where: { id: exc.id } })
    }
  }

  return { deleted: true, mode: 'thisAndFollowing' }
}

/**
 * Get a single event by ID with full details.
 */
export async function getEventById(eventId: string) {
  return prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      calendar: { select: { id: true, name: true, color: true, calendarType: true, visibility: true } },
      category: true,
      building: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true, email: true, avatar: true } },
      approvedBy: { select: { id: true, name: true, firstName: true, lastName: true } },
      attendees: {
        include: { user: { select: { id: true, name: true, firstName: true, lastName: true, avatar: true, email: true } } },
      },
      resourceRequests: true,
    },
  })
}
