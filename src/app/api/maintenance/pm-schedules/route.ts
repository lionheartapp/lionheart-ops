/**
 * GET /api/maintenance/pm-schedules — list PM schedules (with optional calendar view)
 * POST /api/maintenance/pm-schedules — create a new PM schedule
 *
 * Calendar mode: GET ?view=calendar&start=ISO&end=ISO
 * Returns PM schedule events for use in react-big-calendar
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createPmSchedule,
  getPmSchedules,
  getPmCalendarEvents,
} from '@/lib/services/pmScheduleService'
import type { PmScheduleFilters } from '@/lib/services/pmScheduleService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_READ)

    const url = new URL(req.url)
    const view = url.searchParams.get('view')

    // Calendar data mode
    if (view === 'calendar') {
      const start = url.searchParams.get('start') || ''
      const end = url.searchParams.get('end') || ''
      const events = await runWithOrgContext(orgId, () =>
        getPmCalendarEvents(orgId, start, end)
      )
      return NextResponse.json(ok(events))
    }

    // Standard list mode
    const filters: PmScheduleFilters = {
      assetId: url.searchParams.get('assetId') || undefined,
      buildingId: url.searchParams.get('buildingId') || undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      status: (url.searchParams.get('status') || undefined) as PmScheduleFilters['status'],
      keyword: url.searchParams.get('keyword') || undefined,
    }

    const schedules = await runWithOrgContext(orgId, () => getPmSchedules(orgId, filters))
    return NextResponse.json(ok(schedules))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/pm-schedules]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_CREATE)

    const body = await req.json()

    const schedule = await runWithOrgContext(orgId, () => createPmSchedule(orgId, body))
    return NextResponse.json(ok(schedule), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Invalid request data', [error.message]),
          { status: 400 }
        )
      }
    }
    console.error('[POST /api/maintenance/pm-schedules]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
