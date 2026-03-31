/**
 * GET /api/maintenance/pm-schedules — list PM schedules (with optional calendar view)
 * POST /api/maintenance/pm-schedules — create a new PM schedule
 *
 * Calendar mode: GET ?view=calendar&start=ISO&end=ISO
 * Returns PM schedule events for use in react-big-calendar
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createPmSchedule,
  getPmSchedules,
  getPmCalendarEvents,
} from '@/lib/services/pmScheduleService'
import type { PmScheduleFilters } from '@/lib/services/pmScheduleService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const view = searchParams.get('view')

  // Calendar data mode
  if (view === 'calendar') {
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''
    const events = await getPmCalendarEvents(orgId, start, end)
    return NextResponse.json(ok(events))
  }

  // Standard list mode
  const filters: PmScheduleFilters = {
    assetId: searchParams.get('assetId') || undefined,
    buildingId: searchParams.get('buildingId') || undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    status: (searchParams.get('status') || undefined) as PmScheduleFilters['status'],
    keyword: searchParams.get('keyword') || undefined,
  }

  const schedules = await getPmSchedules(orgId, filters)
  return NextResponse.json(ok(schedules))
}, { permission: PERMISSIONS.ASSETS_READ })

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const schedule = await createPmSchedule(orgId, body)
  return NextResponse.json(ok(schedule), { status: 201 })
}, { permission: PERMISSIONS.ASSETS_CREATE })
