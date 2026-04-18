import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'

/**
 * GET /api/calendar-events/external
 *
 * Returns the current user's external calendar events (Google/Microsoft) that
 * fall within [start, end]. Shaped to match `CalendarEventData` so the calendar
 * grid can render them side-by-side with Lionheart events without any case-
 * splitting in the view layer.
 *
 * These events are read-only in Lionheart — the synthetic `calendar` field
 * points at a non-persisted "external" calendar record so the UI can style
 * them distinctly (slate color + lock icon rendered by views).
 */

const EXTERNAL_GOOGLE_CALENDAR = {
  id: 'external:google_calendar',
  name: 'Google Calendar (personal)',
  color: '#64748b', // slate-500 — clearly different from any real calendar color
  calendarType: 'external',
} as const

const EXTERNAL_MICROSOFT_CALENDAR = {
  id: 'external:microsoft_calendar',
  name: 'Microsoft Calendar (personal)',
  color: '#64748b',
  calendarType: 'external',
} as const

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'start and end are required'), { status: 400 })
    }

    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid start or end date'), { status: 400 })
    }

    // Events that overlap the requested window:
    //   (startsAt < windowEnd) AND (endsAt > windowStart)
    const events = await rawPrisma.externalCalendarEvent.findMany({
      where: {
        organizationId: orgId,
        userId: ctx.userId,
        deletedAt: null,
        status: { not: 'cancelled' },
        startsAt: { lt: endDate },
        endsAt: { gt: startDate },
      },
      orderBy: { startsAt: 'asc' },
    })

    const shaped = events.map((e) => {
      const baseCal = e.provider === 'microsoft_calendar' ? EXTERNAL_MICROSOFT_CALENDAR : EXTERNAL_GOOGLE_CALENDAR
      // Use the actual source calendar ID + name so the filter popover
      // can toggle individual external calendars (Work, Personal, etc.)
      const calId = e.sourceCalendarId
        ? `external:${e.provider}:${e.sourceCalendarId}`
        : baseCal.id
      return {
        id: `ext:${e.id}`,
        calendarId: calId,
        title: e.title,
        description: e.description,
        startTime: e.startsAt.toISOString(),
        endTime: e.endsAt.toISOString(),
        timezone: e.timeZone ?? 'UTC',
        isAllDay: e.isAllDay,
        calendarStatus: 'confirmed',
        locationText: e.location,
        metadata: {
          external: true,
          provider: e.provider,
          url: e.url,
          conferenceUrl: e.conferenceUrl,
          sourceCalendarId: e.sourceCalendarId,
          sourceCalendarName: e.sourceCalendarName,
        },
        sourceModule: 'external',
        sourceId: e.id,
        calendar: {
          id: calId,
          name: e.sourceCalendarName || baseCal.name,
          color: baseCal.color,
          calendarType: 'external',
        },
        category: null,
        building: null,
        area: null,
        createdBy: null,
        attendees: [],
      }
    })

    return NextResponse.json(ok(shaped))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(fail('INTERNAL_ERROR', message), { status: 500 })
  }
}
