import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'

/**
 * GET /api/integrations/google-calendar/calendars
 * Returns the user's Google Calendar list so they can choose which to sync.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    const result = await googleCalendarService.listCalendars(ctx.userId, ctx.organizationId)
    if (!result) {
      return NextResponse.json(fail('NOT_FOUND', 'No active Google Calendar connection'), { status: 404 })
    }

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * PUT /api/integrations/google-calendar/calendars
 * Saves the user's selected calendar IDs for sync.
 * Body: { calendarIds: string[] }
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    const body = await req.json()
    const calendarIds = body.calendarIds
    if (!Array.isArray(calendarIds)) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'calendarIds must be an array'), { status: 400 })
    }

    await googleCalendarService.setSelectedCalendars(ctx.userId, ctx.organizationId, calendarIds)
    return NextResponse.json(ok({ calendarIds }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
