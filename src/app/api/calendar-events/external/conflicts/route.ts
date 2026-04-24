import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { cachePerUser } from '@/lib/cache/route-cache'

/**
 * GET /api/calendar-events/external/conflicts?startsAt=&endsAt=
 *
 * Returns external calendar events belonging to the current user that overlap
 * the requested time window. Used by the event-create flow to show a blocking
 * "You have a conflict" warning before submission.
 *
 * Overlap rule: (event.startsAt < endsAt) AND (event.endsAt > startsAt).
 * Returns a compact shape — just what the warning dialog needs — rather than
 * the full calendar-event shape.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const { searchParams } = new URL(req.url)
    const startsAt = searchParams.get('startsAt')
    const endsAt = searchParams.get('endsAt')

    if (!startsAt || !endsAt) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'startsAt and endsAt are required'), { status: 400 })
    }

    const windowStart = new Date(startsAt)
    const windowEnd = new Date(endsAt)
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid timestamps'), { status: 400 })
    }
    if (windowEnd <= windowStart) {
      return NextResponse.json(ok({ conflicts: [] }))
    }

    const conflicts = await cachePerUser(
      ctx.userId,
      `external-conflicts:${startsAt}:${endsAt}`,
      () => rawPrisma.externalCalendarEvent.findMany({
        where: {
          organizationId: orgId,
          userId: ctx.userId,
          deletedAt: null,
          status: { not: 'cancelled' },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        orderBy: { startsAt: 'asc' },
        take: 25, // UI only needs enough to populate a warning modal
        select: {
          id: true,
          provider: true,
          title: true,
          startsAt: true,
          endsAt: true,
          isAllDay: true,
          location: true,
          url: true,
        },
      }),
      { ttlMs: 60000 }
    )

    return NextResponse.json(ok({
      conflicts: conflicts.map((c) => ({
        id: c.id,
        provider: c.provider,
        title: c.title,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        isAllDay: c.isAllDay,
        location: c.location,
        url: c.url,
      })),
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(fail('INTERNAL_ERROR', message), { status: 500 })
  }
}
