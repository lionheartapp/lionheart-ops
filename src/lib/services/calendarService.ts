import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { expandRecurrence } from './recurrenceService'
import { getOrgContextId } from '@/lib/org-context'
import type {
  CalendarEventStatus,
  ApprovalChannel,
  ApprovalStatus,
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
  areaId?: string | null
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
  areaId?: string | null
  metadata?: Record<string, unknown>
}

type EditMode = 'this' | 'thisAndFollowing' | 'all'

// ─── Calendar CRUD ─────────────────────────────────────────────────────

export async function getCalendars(filters?: {
  calendarType?: string
  campusId?: string
  schoolId?: string
  isActive?: boolean
  userId?: string
  roleName?: string
}) {
  const where: Prisma.CalendarWhereInput = {}

  if (filters?.calendarType) {
    where.calendarType = filters.calendarType as any
  }
  if (filters?.campusId) {
    where.campusId = filters.campusId
  }
  if (filters?.schoolId) {
    where.schoolId = filters.schoolId
  }
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  // Filter personal calendars so each user only sees their own "My Schedule"
  const isAdmin = filters?.roleName && ['super admin', 'super-admin', 'administrator', 'admin'].includes(filters.roleName.toLowerCase())
  if (filters?.userId) {
    if (isAdmin) {
      // Admins see all non-personal calendars + only their own personal calendar
      where.OR = [
        { calendarType: { not: 'PERSONAL' as any } },
        { createdById: filters.userId, calendarType: 'PERSONAL' as any },
      ]
    } else {
      // Non-admins: filter by campus assignments + own personal calendar
      const campusAssignments = await prisma.userCampusAssignment.findMany({
        where: { userId: filters.userId, isActive: true },
        select: { campusId: true },
      })
      const userCampusIds = campusAssignments.map((a) => a.campusId)

      where.OR = [
        // Campus master calendars the user belongs to
        ...(userCampusIds.length > 0
          ? [{ campusId: { in: userCampusIds }, calendarType: { not: 'PERSONAL' as any } }]
          : []),
        // Org-wide calendars (no campus, non-personal)
        { campusId: null, calendarType: { not: 'PERSONAL' as any } },
        // User's own personal calendar
        { createdById: filters.userId, calendarType: 'PERSONAL' as any },
      ]
    }
  }

  return prisma.calendar.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true } },
      _count: { select: { events: true, subscriptions: true } },
    },
  })
}

export async function getCalendarById(id: string) {
  return prisma.calendar.findUnique({
    where: { id },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      categories: true,
      _count: { select: { events: true, subscriptions: true } },
    },
  })
}

export async function createCalendar(data: {
  name: string
  slug: string
  calendarType: string
  color?: string
  visibility?: string
  requiresApproval?: boolean
  campusId?: string
  schoolId?: string
  isDefault?: boolean
  createdById?: string
}) {
  // Default calendar color to the school's color when schoolId is provided and no explicit color
  let resolvedColor = data.color
  if (!resolvedColor && data.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: data.schoolId },
      select: { color: true },
    })
    if (school?.color) {
      resolvedColor = school.color
    }
  }

  return prisma.calendar.create({
    data: {
      name: data.name,
      slug: data.slug,
      calendarType: data.calendarType as any,
      color: resolvedColor || '#3b82f6',
      visibility: (data.visibility as any) || 'ORG_WIDE',
      requiresApproval: data.requiresApproval || false,
      campusId: data.campusId,
      schoolId: data.schoolId,
      isDefault: data.isDefault || false,
      createdById: data.createdById,
    } as any, // Org-scoped extension injects organizationId at runtime
  })
}

export async function updateCalendar(id: string, data: Partial<{
  name: string
  slug: string
  color: string
  visibility: string
  requiresApproval: boolean
  isDefault: boolean
  isActive: boolean
}>) {
  return prisma.calendar.update({
    where: { id },
    data: data as any,
  })
}

export async function deleteCalendar(id: string) {
  return prisma.calendar.delete({ where: { id } })
}

// ─── Location Conflict Detection ────────────────────────────────────────

export class LocationConflictError extends Error {
  code = 'LOCATION_CONFLICT' as const
  details: {
    conflictingEventId: string
    conflictingEventTitle: string
    conflictingStart: string
    conflictingEnd: string
    bufferMinutes: number
    location: string
  }
  constructor(details: LocationConflictError['details']) {
    super(`Location conflict with "${details.conflictingEventTitle}"`)
    this.details = details
  }
}

/**
 * Check if an event at the given time + location conflicts with an existing event
 * (including the org's configured buffer time on both sides).
 */
export async function checkLocationConflict(opts: {
  startTime: Date
  endTime: Date
  buildingId?: string | null
  areaId?: string | null
  locationText?: string
  excludeEventId?: string
}): Promise<{ hasConflict: false } | { hasConflict: true; conflictingEvent: { id: string; title: string; startTime: Date; endTime: Date; location: string } ; bufferMinutes: number }> {
  const { startTime, endTime, buildingId, areaId, locationText, excludeEventId } = opts

  // No location data → skip check
  if (!buildingId && !areaId && !locationText) {
    return { hasConflict: false }
  }

  // Fetch org buffer setting
  const orgId = getOrgContextId()
  if (!orgId) return { hasConflict: false }

  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { eventBufferMinutes: true },
  })
  const bufferMinutes = org?.eventBufferMinutes ?? 60
  if (bufferMinutes <= 0) return { hasConflict: false }

  const bufferMs = bufferMinutes * 60_000
  const windowStart = new Date(startTime.getTime() - bufferMs)
  const windowEnd = new Date(endTime.getTime() + bufferMs)

  // Build location match clause (tiered)
  const locationWhere: Prisma.CalendarEventWhereInput = buildingId && areaId
    ? { buildingId, areaId }
    : buildingId
      ? { buildingId, areaId: null }
      : areaId
        ? { areaId, buildingId: null }
        : { locationText: { equals: locationText!, mode: 'insensitive' } }

  const where: Prisma.CalendarEventWhereInput = {
    ...locationWhere,
    // Event overlaps with expanded window
    startTime: { lt: windowEnd },
    endTime: { gt: windowStart },
    // Don't conflict with self
    ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    // Only check confirmed/pending events, not cancelled/draft
    calendarStatus: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
  }

  const conflict = await prisma.calendarEvent.findFirst({
    where,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      locationText: true,
      building: { select: { name: true } },
      area: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  if (!conflict) return { hasConflict: false }

  const location = [conflict.building?.name, conflict.area?.name].filter(Boolean).join(' — ')
    || conflict.locationText
    || 'Same location'

  return {
    hasConflict: true,
    conflictingEvent: {
      id: conflict.id,
      title: conflict.title,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      location,
    },
    bufferMinutes,
  }
}

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
      areaId: input.areaId,
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

  const event = await prisma.calendarEvent.create({
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
      areaId: input.areaId,
      metadata: input.metadata as any,
      createdById: userId,
    } as any, // Org-scoped extension injects organizationId at runtime
    include: {
      calendar: { select: { id: true, name: true, color: true, calendarType: true } },
      category: true,
      building: { select: { id: true, name: true } },
      area: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
    },
  })

  return event
}

/**
 * Submit a DRAFT event for approval. Creates EventApproval records
 * for each required approval channel.
 */
export async function submitForApproval(eventId: string, userId: string) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { calendar: true, resourceRequests: true },
  })

  if (!event) throw new Error('Event not found')
  if (event.calendarStatus !== 'DRAFT') {
    throw new Error('Only DRAFT events can be submitted for approval')
  }
  if (event.createdById !== userId) {
    throw new Error('Only the creator can submit for approval')
  }

  // Get approval channel configs for this org
  const channels = await prisma.approvalChannelConfig.findMany({
    where: { mode: 'REQUIRED' },
  })

  // Determine which channels apply based on resource needs
  const resourceTypes = event.resourceRequests.map((r) => r.resourceType)
  const channelTypeMap: Record<string, string[]> = {
    ADMIN: [], // Always triggered
    FACILITIES: ['FACILITY'],
    AV_PRODUCTION: ['AV_EQUIPMENT'],
    CUSTODIAL: ['CUSTODIAL'],
    SECURITY: [],
    ATHLETIC_DIRECTOR: [],
  }

  const approvalRecords: Array<{ eventId: string; channelType: ApprovalChannel; approvalStatus: ApprovalStatus }> = []

  for (const channel of channels) {
    const requiredResourceTypes = channelTypeMap[channel.channelType] || []
    const isAdmin = channel.channelType === 'ADMIN'
    const hasRelevantResource = requiredResourceTypes.length === 0 ||
      requiredResourceTypes.some((rt) => resourceTypes.includes(rt as any))

    if (isAdmin || hasRelevantResource) {
      approvalRecords.push({
        eventId,
        channelType: channel.channelType,
        approvalStatus: 'PENDING',
      })
    } else if (channel.autoApproveIfNoResource) {
      approvalRecords.push({
        eventId,
        channelType: channel.channelType,
        approvalStatus: 'AUTO_APPROVED',
      })
    }
  }

  // If no approval channels configured, just mark ADMIN as required
  if (approvalRecords.length === 0) {
    approvalRecords.push({
      eventId,
      channelType: 'ADMIN',
      approvalStatus: 'PENDING',
    })
  }

  // Create approvals and update event status in a transaction-like flow
  for (const record of approvalRecords) {
    await prisma.eventApproval.create({ data: record as any })
  }

  return prisma.calendarEvent.update({
    where: { id: eventId },
    data: { calendarStatus: 'PENDING_APPROVAL' },
    include: {
      approvals: true,
      calendar: { select: { id: true, name: true, color: true } },
    },
  })
}

/**
 * Approve an event for a specific channel.
 * If all required channels are approved, event becomes CONFIRMED.
 */
export async function approveEvent(
  eventId: string,
  channelType: ApprovalChannel,
  approverId: string
) {
  const approval = await prisma.eventApproval.update({
    where: { eventId_channelType: { eventId, channelType } },
    data: {
      approvalStatus: 'APPROVED',
      respondedById: approverId,
      respondedAt: new Date(),
    },
  })

  // Check if all channels are approved
  const allApprovals = await prisma.eventApproval.findMany({
    where: { eventId },
  })

  const allApproved = allApprovals.every(
    (a) => a.approvalStatus === 'APPROVED' || a.approvalStatus === 'AUTO_APPROVED' || a.approvalStatus === 'SKIPPED'
  )

  if (allApproved) {
    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        calendarStatus: 'CONFIRMED',
        approvedById: approverId,
      },
    })
  }

  return approval
}

/**
 * Reject an event for a specific channel.
 */
export async function rejectEvent(
  eventId: string,
  channelType: ApprovalChannel,
  approverId: string,
  reason: string
) {
  const approval = await prisma.eventApproval.update({
    where: { eventId_channelType: { eventId, channelType } },
    data: {
      approvalStatus: 'REJECTED',
      respondedById: approverId,
      respondedAt: new Date(),
      reason,
    },
  })

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { calendarStatus: 'REJECTED' },
  })

  return approval
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
      area: { select: { id: true, name: true } },
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
    const checkAreaId = data.areaId === undefined ? event.areaId : data.areaId
    const checkLocationText = data.locationText === undefined ? event.locationText : data.locationText

    const conflict = await checkLocationConflict({
      startTime: checkStart,
      endTime: checkEnd,
      buildingId: checkBuildingId,
      areaId: checkAreaId,
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
      data: data as any,
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
    return prisma.calendarEvent.create({
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
        areaId: data.areaId === undefined ? event.areaId : data.areaId,
        metadata: (data.metadata as any) ?? event.metadata,
        parentEventId: event.parentEventId || event.id,
        originalStart: exceptionOriginalStart,
        createdById: userId,
      } as any, // Org-scoped extension injects organizationId at runtime
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
  return prisma.calendarEvent.create({
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
      areaId: data.areaId === undefined ? event.areaId : data.areaId,
      metadata: (data.metadata as any) ?? event.metadata,
      createdById: userId,
    } as any, // Org-scoped extension injects organizationId at runtime
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

    return prisma.calendarEvent.create({
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
        areaId: event.areaId,
        metadata: event.metadata as any,
        parentEventId: event.parentEventId || event.id,
        originalStart: exceptionOriginalStart,
        createdById: event.createdById,
      } as any,
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
      area: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true, email: true, avatar: true } },
      approvedBy: { select: { id: true, name: true, firstName: true, lastName: true } },
      attendees: {
        include: { user: { select: { id: true, name: true, firstName: true, lastName: true, avatar: true, email: true } } },
      },
      approvals: {
        include: { respondedBy: { select: { id: true, name: true, firstName: true, lastName: true } } },
      },
      resourceRequests: true,
    },
  })
}

// ─── Calendar Categories ───────────────────────────────────────────────

export async function getCategories(calendarType?: string) {
  const where: Prisma.CalendarCategoryWhereInput = {}
  if (calendarType) {
    where.OR = [
      { calendarType: calendarType as any },
      { calendarType: null },
    ]
  }
  return prisma.calendarCategory.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function createCategory(data: {
  name: string
  color?: string
  icon?: string
  calendarType?: string
  calendarId?: string
}) {
  return prisma.calendarCategory.create({
    data: {
      name: data.name,
      color: data.color || '#6b7280',
      icon: data.icon,
      calendarType: data.calendarType as any,
      calendarId: data.calendarId,
    } as any, // Org-scoped extension injects organizationId at runtime
  })
}

// ─── User Schedule (Meet With) ─────────────────────────────────────────

/**
 * Get events for a specific user in a date range.
 * Returns events where the user is the creator OR an attendee.
 * Includes CONFIRMED, TENTATIVE, and PENDING_APPROVAL events since all represent time commitments.
 */
export async function getEventsForUser(userId: string, start: Date, end: Date) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      calendarStatus: { in: ['CONFIRMED', 'TENTATIVE', 'PENDING_APPROVAL'] as any[] },
      parentEventId: null,
      OR: [
        // Events created by the user (non-recurring in range, or recurring parent)
        {
          createdById: userId,
          OR: [
            { rrule: null, startTime: { lte: end }, endTime: { gte: start } },
            { rrule: { not: null } },
          ],
        },
        // Events where the user is an attendee
        {
          attendees: { some: { userId } },
          OR: [
            { rrule: null, startTime: { lte: end }, endTime: { gte: start } },
            { rrule: { not: null } },
          ],
        },
      ],
    },
    include: {
      calendar: { select: { id: true, name: true, color: true, calendarType: true, campus: { select: { id: true, name: true } } } },
      category: true,
      building: { select: { id: true, name: true } },
      area: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
      attendees: {
        include: { user: { select: { id: true, name: true, firstName: true, lastName: true, avatar: true } } },
      },
      exceptions: true,
    },
    orderBy: { startTime: 'asc' },
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

// ─── Attendee Management ──────────────────────────────────────────────

/**
 * Get all attendees for an event.
 */
export async function getEventAttendees(eventId: string) {
  return prisma.eventAttendee.findMany({
    where: { eventId },
    select: { userId: true },
  })
}

/**
 * Add attendees to an event.
 */
export async function addAttendees(eventId: string, userIds: string[]) {
  const records = await Promise.all(
    userIds.map((userId) =>
      prisma.eventAttendee.upsert({
        where: { eventId_userId: { eventId, userId } },
        update: {},
        create: { eventId, userId, responseStatus: 'PENDING' } as any,
      })
    )
  )
  return records
}

/**
 * Remove an attendee from an event.
 */
export async function removeAttendee(eventId: string, userId: string) {
  return prisma.eventAttendee.delete({
    where: { eventId_userId: { eventId, userId } },
  })
}

/**
 * Update an attendee's RSVP status with optional note.
 */
export async function updateRsvpStatus(
  eventId: string,
  userId: string,
  status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
  responseNote?: string
) {
  return prisma.eventAttendee.update({
    where: { eventId_userId: { eventId, userId } },
    data: {
      responseStatus: status,
      respondedAt: new Date(),
      responseNote: responseNote || null,
    },
  })
}

// ─── Calendar Subscriptions ────────────────────────────────────────────

export async function getUserSubscriptions(userId: string) {
  return prisma.calendarSubscription.findMany({
    where: { userId },
    include: {
      calendar: {
        select: { id: true, name: true, color: true, calendarType: true, isActive: true },
      },
    },
  })
}

export async function toggleSubscription(userId: string, calendarId: string, isVisible: boolean) {
  return prisma.calendarSubscription.upsert({
    where: { userId_calendarId: { userId, calendarId } },
    update: { isVisible },
    create: { userId, calendarId, isVisible },
  })
}
