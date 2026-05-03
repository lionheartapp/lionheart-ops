import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import type { CalendarEventStatus } from '@prisma/client'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

/**
 * F-036: POST-with-body alternative to `GET /api/calendar-events`.
 *
 * The GET endpoint takes calendarIds as a comma-joined query string. With 30+
 * calendars (multi-campus organizations) the URL exceeds the 8KB practical
 * limit and starts getting truncated by middleboxes / load balancers /
 * Next.js's own request logging. POST-with-body has no such limit.
 *
 * This endpoint accepts the SAME inputs the GET does, but in a JSON body —
 * the response shape is identical so the client can swap freely.
 *
 * The full GET route also synthesizes EventProject pseudo-events into the
 * response. We deliberately skip that here because the POST route is only
 * called by the calendar widgets that don't render EventProject overlays;
 * if you need the full union, use GET. Adding it here is a future TODO if
 * a consumer needs it.
 */

const RangeQuerySchema = z.object({
  calendarIds: z.array(z.string().min(1)).min(1).max(500),
  start: z.string().datetime(),
  end: z.string().datetime(),
  categoryId: z.string().optional().nullable(),
  status: z.array(z.string()).optional(),
  createdById: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/calendar-events/query', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)

    const body = await req.json().catch(() => ({}))
    const parsed = RangeQuerySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid range query', parsed.error.issues),
        { status: 400 }
      )
    }

    const { calendarIds, start, end, categoryId, status, createdById } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const events = await calendarService.getEventsInRange(
        calendarIds,
        new Date(start),
        new Date(end),
        {
          categoryId: categoryId ?? undefined,
          calendarStatus: (status as CalendarEventStatus[] | undefined) ?? undefined,
          createdById: createdById ?? undefined,
          // Same defaults as the GET path's max page size
          skip: 0,
          take: 500,
        }
      )

      return NextResponse.json(ok(events), {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(
        fail('FORBIDDEN', 'You do not have permission to perform this action'),
        { status: 403 }
      )
    }
    log.error(
      {
        err: error,
        message: error instanceof Error ? error.message : String(error),
      },
      'Failed to query calendar events'
    )
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
