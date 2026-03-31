import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthleticsCalendarEvents } from '@/lib/services/athleticsService'

export const GET = withAuth(async ({ searchParams }) => {
  const campusIds = searchParams.get('campusIds')?.split(',').filter(Boolean) || []
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

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

  const events = await getAthleticsCalendarEvents(campusIds, start, end)
  return NextResponse.json(ok(events), {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    },
  })
}, { permission: PERMISSIONS.ATHLETICS_READ })
