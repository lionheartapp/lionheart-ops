import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, can, canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import type { CalendarEventStatus } from '@prisma/client'
import { LocationConflictError } from '@/lib/services/calendarService'
import { embedCalendarEvent } from '@/lib/services/ai/embeddingTriggers'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const db = prisma as unknown as OrgPrismaClient

const createEventSchema = z.object({
  calendarId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().optional(),
  isAllDay: z.boolean().optional(),
  rrule: z.string().optional(),
  categoryId: z.string().optional(),
  locationText: z.string().optional(),
  buildingId: z.string().optional().nullable(),
  spaceId: z.string().optional().nullable(),
  /** @deprecated Phase 1b — use spaceId */
  areaId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  attendeeIds: z.array(z.string()).optional(),
  skipConflictCheck: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/calendar-events', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const calendarIds = searchParams.get('calendarIds')?.split(',').filter(Boolean) || []
      const start = searchParams.get('start')
      const end = searchParams.get('end')

      if (!start || !end) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'start and end query parameters are required'),
          { status: 400 }
        )
      }

      if (calendarIds.length === 0) {
        // If no calendar IDs provided, get all active calendars for the user
        const calendars = await calendarService.getCalendars({ isActive: true })
        calendarIds.push(...calendars.map((c) => c.id))
      }

      const { page, limit, skip } = parsePagination(searchParams, 100, 500)

      const eventFilters = {
        categoryId: searchParams.get('categoryId') || undefined,
        calendarStatus: searchParams.get('status')?.split(',') as CalendarEventStatus[] | undefined || undefined,
        createdById: searchParams.get('createdById') || undefined,
      }
      const startDate = new Date(start)
      const endDate = new Date(end)

      // Fetch legacy CalendarEvents in range
      const [events, attendeeEvents] = await Promise.all([
        calendarService.getEventsInRange(
          calendarIds,
          startDate,
          endDate,
          { ...eventFilters, skip, take: limit }
        ),
        // Also fetch events where this user is an attendee but may not be
        // subscribed to the calendar — ensures invites always appear.
        calendarService.getEventsForAttendee(ctx.userId, startDate, endDate),
      ])

      // Merge attendee events that aren't already in the main set
      const mainIds = new Set(events.map((e: { id: string }) => e.id))
      const extraAttendee = attendeeEvents.filter((e: { id: string }) => !mainIds.has(e.id))
      if (extraAttendee.length > 0) {
        events.push(...extraAttendee)
      }

      // ── Also fetch EventProjects in range and map them to the calendar
      // event shape so they render on the calendar alongside confirmed events.
      // This closes the gap where events created from the /events hub didn't
      // appear on /calendar until approval. Pending ones are returned so
      // the calendar can render them with a "pending" style (the client can
      // inspect `sourceModule === 'event-project'` + `calendarStatus`).
      const eventProjects = await db.eventProject.findMany({
        where: {
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
          startsAt: { lte: endDate },
          endsAt: { gte: startDate },
        },
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true,
          status: true,
          locationText: true,
          buildingId: true,
          spaceId: true,
          createdById: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
          },
          building: { select: { id: true, name: true } },
          space: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: 'asc' },
      })

      // Map EventProject → CalendarEventData shape. We synthesize a virtual
      // calendar for "events hub" items so they group visually. Status is
      // mapped to calendarStatus so the client can render pending ones muted.
      const HUB_CALENDAR = {
        id: '__event-project__',
        name: 'Event Hub',
        color: '#a8a49d',
        calendarType: 'EVENT_PROJECT',
        campus: null,
      }
      const projectEvents = eventProjects.map((p) => {
        const isConfirmedish = p.status === 'CONFIRMED' || p.status === 'IN_PROGRESS' || p.status === 'COMPLETED'
        return {
          id: `ep_${p.id}`,
          calendarId: HUB_CALENDAR.id,
          title: p.title,
          description: p.description,
          startTime: p.startsAt instanceof Date ? p.startsAt.toISOString() : p.startsAt,
          endTime: p.endsAt instanceof Date ? p.endsAt.toISOString() : p.endsAt,
          timezone: 'UTC',
          isAllDay: false,
          calendarStatus: isConfirmedish ? 'CONFIRMED' : p.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
          rrule: null,
          parentEventId: null,
          isException: false,
          locationText: p.locationText,
          categoryId: null,
          sourceModule: 'event-project',
          sourceId: p.id,
          calendar: HUB_CALENDAR,
          category: null,
          building: p.building,
          space: p.space,
          // Backward-compat alias
          area: p.space,
          createdBy: p.createdBy
            ? {
                id: p.createdBy.id,
                name: null,
                firstName: p.createdBy.firstName,
                lastName: p.createdBy.lastName,
                email: p.createdBy.email,
                avatar: p.createdBy.avatar,
              }
            : null,
          attendees: [],
        }
      })

      // Deduplicate: if a confirmed EventProject has already created a
      // bridge CalendarEvent via `confirmEventProject`, we'd show it twice.
      // Drop the bridge version when an EventProject shadow exists with the
      // same (startTime, title).
      const projectKey = new Set(
        projectEvents
          .filter((p) => p.calendarStatus === 'CONFIRMED')
          .map((p) => `${p.startTime}__${p.title}`),
      )
      const deduped = events.filter((e) => {
        const key = `${(e as { startTime: string }).startTime}__${(e as { title: string }).title}`
        return !projectKey.has(key)
      })

      const combined = [...deduped, ...projectEvents].sort((a, b) => {
        const aStart = String((a as { startTime: string | Date }).startTime)
        const bStart = String((b as { startTime: string | Date }).startTime)
        return aStart.localeCompare(bStart)
      })

      return NextResponse.json(ok(combined, paginationMeta(combined.length, { page, limit, skip })), {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    log.error({ err: error, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Failed to fetch calendar events')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/calendar-events', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    // Members with CREATE_OWN can create events on personal/campus calendars
    const hasCreatePerm = await canAny(ctx.userId, [
      PERMISSIONS.CALENDAR_EVENTS_CREATE,
      PERMISSIONS.CALENDAR_EVENTS_CREATE_OWN,
    ])
    if (!hasCreatePerm) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }

    const body = await req.json()
    const data = createEventSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const canPublish = await can(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_PUBLISH)

      const { attendeeIds, skipConflictCheck, ...eventData } = data
      const event = await calendarService.createEvent(
        {
          ...eventData,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
        },
        ctx.userId,
        canPublish,
        skipConflictCheck
      )

      // Create attendee records if provided
      if (attendeeIds && attendeeIds.length > 0) {
        await calendarService.addAttendees(event.id, attendeeIds)
      }

      void embedCalendarEvent(event.id, {
        title: event.title,
        description: event.description,
        locationText: event.locationText,
      })

      return NextResponse.json(ok(event), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.error({ err: error }, 'calendar-events POST validation error')
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof LocationConflictError) {
      return NextResponse.json(
        fail('LOCATION_CONFLICT', error.message, error.details),
        { status: 409 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create calendar event')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
