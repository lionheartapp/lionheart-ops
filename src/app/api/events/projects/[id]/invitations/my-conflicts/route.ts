import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'

interface ConflictItem {
  id: string
  source: 'internal' | 'external'
  title: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  location: string | null
  provider?: string
}

/**
 * GET /api/events/projects/[id]/invitations/my-conflicts
 *
 * Returns all schedule conflicts for the current user during this event's
 * time window. Checks both internal calendar events and external calendar
 * events (Google, Microsoft).
 */
export const GET = withAuth(async ({ ctx, params }) => {
  // Fetch the event to get its time window
  const event = await prisma.eventProject.findUnique({
    where: { id: params.id },
    select: { startsAt: true, endsAt: true },
  })

  if (!event) {
    return NextResponse.json(ok({ conflicts: [], hasConflicts: false }))
  }

  const windowStart = new Date(event.startsAt)
  const windowEnd = new Date(event.endsAt)

  // Check internal calendar events where user is creator or attendee
  const internalEventsPromise = prisma.calendarEvent.findMany({
    where: {
      deletedAt: null,
      calendarStatus: { in: ['CONFIRMED', 'TENTATIVE', 'PENDING_APPROVAL'] },
      startTime: { lt: windowEnd },
      endTime: { gt: windowStart },
      OR: [
        { createdById: ctx.userId },
        { attendees: { some: { userId: ctx.userId } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      isAllDay: true,
      locationText: true,
    },
    orderBy: { startTime: 'asc' },
    take: 10,
  })

  // Check internal event projects where user is team member or creator
  const internalProjectsPromise = prisma.eventProject.findMany({
    where: {
      deletedAt: null,
      id: { not: params.id }, // Exclude the current event
      status: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
      OR: [
        { createdById: ctx.userId },
        { teamMembers: { some: { userId: ctx.userId } } },
        { invitations: { some: { userId: ctx.userId, status: 'ACCEPTED' } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      isMultiDay: true,
      locationText: true,
    },
    orderBy: { startsAt: 'asc' },
    take: 10,
  })

  // Check external calendar events (Google, Microsoft)
  const externalEventsPromise = rawPrisma.externalCalendarEvent.findMany({
    where: {
      userId: ctx.userId,
      deletedAt: null,
      status: { not: 'cancelled' },
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
    },
    select: {
      id: true,
      provider: true,
      title: true,
      startsAt: true,
      endsAt: true,
      isAllDay: true,
      location: true,
    },
    orderBy: { startsAt: 'asc' },
    take: 10,
  })

  const [internalEvents, internalProjects, externalEvents] = await Promise.all([
    internalEventsPromise,
    internalProjectsPromise,
    externalEventsPromise,
  ])

  const conflicts: ConflictItem[] = [
    ...internalEvents.map((e) => ({
      id: e.id,
      source: 'internal' as const,
      title: e.title,
      startsAt: e.startTime.toISOString(),
      endsAt: e.endTime.toISOString(),
      isAllDay: e.isAllDay,
      location: e.locationText,
    })),
    ...internalProjects.map((p) => ({
      id: p.id,
      source: 'internal' as const,
      title: p.title,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt.toISOString(),
      isAllDay: p.isMultiDay,
      location: p.locationText,
    })),
    ...externalEvents.map((e) => ({
      id: e.id,
      source: 'external' as const,
      title: e.title ?? 'Busy',
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      isAllDay: e.isAllDay,
      location: e.location,
      provider: e.provider,
    })),
  ]

  // Sort by start time
  conflicts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  return NextResponse.json(ok({
    conflicts,
    hasConflicts: conflicts.length > 0,
  }))
})
