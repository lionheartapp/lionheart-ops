import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthleticsCalendarEvents } from '@/lib/services/athleticsService'
import { ok, fail } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    const campusIds = req.nextUrl.searchParams.get('campusIds')?.split(',').filter(Boolean) || []
    const startParam = req.nextUrl.searchParams.get('start')
    const endParam = req.nextUrl.searchParams.get('end')

    if (campusIds.length === 0 || !startParam || !endParam) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'campusIds, start, and end are required'),
        { status: 400 }
      )
    }

    const start = new Date(startParam)
    const end = new Date(endParam)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'start and end must be valid ISO dates'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const events = await getAthleticsCalendarEvents(campusIds, start, end)
      return NextResponse.json(ok(events), {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Athletics calendar events error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
