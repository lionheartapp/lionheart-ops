/**
 * Calendar Service — Categories, User Schedule, Attendees & Subscriptions
 *
 * Calendar categories, per-user event queries, attendee management,
 * RSVP status updates, and calendar subscription toggles.
 */

import { prisma } from '@/lib/db'
import { expandRecurrence } from './recurrenceService'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'
import type {
  CalendarEventStatus,
  CalendarType,
  Prisma,
} from '@prisma/client'

// ─── Calendar Categories ───────────────────────────────────────────────

export async function getCategories(calendarType?: string) {
  const where: Prisma.CalendarCategoryWhereInput = {}
  if (calendarType) {
    where.OR = [
      { calendarType: calendarType as CalendarType },
      { calendarType: null },
    ]
  }
  const orgId = getOrgContextId()
  const bucket = `calendar-categories:list:type=${calendarType ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    prisma.calendarCategory.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
  )
}

export async function createCategory(data: {
  name: string
  color?: string
  icon?: string
  calendarType?: string
  calendarId?: string
}) {
  const result = await (prisma.calendarCategory.create as Function)({
    data: {
      name: data.name,
      color: data.color || '#6b7280',
      icon: data.icon,
      calendarType: data.calendarType,
      calendarId: data.calendarId,
    },
  })
  invalidateOrgCache(getOrgContextId(), 'calendar-categories')
  return result
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
      calendarStatus: { in: ['CONFIRMED', 'TENTATIVE', 'PENDING_APPROVAL'] as CalendarEventStatus[] },
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
      space: { select: { id: true, name: true } },
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
        create: { eventId, userId, responseStatus: 'PENDING' },
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

export async function toggleNotifyOnNew(userId: string, calendarId: string, notifyOnNew: boolean) {
  return prisma.calendarSubscription.upsert({
    where: { userId_calendarId: { userId, calendarId } },
    update: { notifyOnNew },
    create: { userId, calendarId, notifyOnNew },
  })
}

export async function updateSubscriptionPrefs(
  userId: string,
  calendarId: string,
  data: { notifyBeforeMinutes?: number | null },
) {
  return prisma.calendarSubscription.upsert({
    where: { userId_calendarId: { userId, calendarId } },
    update: data,
    create: { userId, calendarId, ...data },
  })
}

/** Get all user IDs subscribed to a calendar with notifyOnNew enabled */
export async function getCalendarNotifySubscribers(calendarId: string): Promise<string[]> {
  const subs = await prisma.calendarSubscription.findMany({
    where: { calendarId, notifyOnNew: true },
    select: { userId: true },
  })
  return subs.map((s) => s.userId)
}
