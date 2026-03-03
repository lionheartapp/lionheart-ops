import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!userId || !start || !end) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'userId, start, and end query parameters are required'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const events = await calendarService.getEventsForUser(
        userId,
        new Date(start),
        new Date(end)
      )
      return NextResponse.json(ok(events))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
