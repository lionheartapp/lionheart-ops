import { prisma } from '@/lib/db'
import { expandRecurrence } from './recurrenceService'
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
  buildingId?: string
  areaId?: string
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
  categoryId?: string
  locationText?: string
  buildingId?: string
  areaId?: string
  metadata?: Record<string, unknown>
}

type EditMode = 'this' | 'thisAndFollowing' | 'all'

// ─── Calendar CRUD ─────────────────────────────────────────────────────

export async function getCalendars(filters?: {
  calendarType?: string
  campusId?: string
  schoolId?: string
  isActive?: boolean
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

  return prisma.calendar.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
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
}) {
  return prisma.calendar.create({
    data: {
      name: data.name,
      slug: data.slug,
      calendarType: data.calendarType as any,
      color: data.color || '#3b82f6',
      visibility: (data.visibility as any) || 'ORG_WIDE',
      requiresApproval: data.requiresApproval || false,
      campusId: data.campusId,
      schoolId: data.schoolId,
      isDefault: data.isDefault || false,
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

// ─── Calendar Event CRUD ───────────────────────────────────────────────

/**
 * Create a calendar event.
 * Status is determined by: publish permission → CONFIRMED, approval required → DRAFT.
 */
export async function createEvent(
  input: CreateEventInput,
  userId: string,
  canPublish: boolean
) {
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
      {
        rrule: { not: null },
        parentEventId: null, // Only parent events
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
      calendar: { select: { id: true, name: true, color: true, calendarType: true } },
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

/**
 * Update an event with three-mode editing for recurring events.
 */
export async function updateEvent(
  eventId: string,
  data: UpdateEventInput,
  editMode: EditMode,
  userId: string
) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  })

  if (!event) throw new Error('Event not found')

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

  // 'this' mode: create an exception
  if (editMode === 'this') {
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
        categoryId: data.categoryId ?? event.categoryId,
        locationText: data.locationText ?? event.locationText,
        buildingId: data.buildingId ?? event.buildingId,
        areaId: data.areaId ?? event.areaId,
        metadata: (data.metadata as any) ?? event.metadata,
        parentEventId: event.parentEventId || event.id,
        originalStart: event.startTime,
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
      categoryId: data.categoryId ?? event.categoryId,
      locationText: data.locationText ?? event.locationText,
      buildingId: data.buildingId ?? event.buildingId,
      areaId: data.areaId ?? event.areaId,
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
 * Delete an event (soft-delete).
 */
export async function deleteEvent(eventId: string) {
  return prisma.calendarEvent.delete({ where: { id: eventId } })
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
