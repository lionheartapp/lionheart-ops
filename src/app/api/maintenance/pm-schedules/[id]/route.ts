/**
 * GET /api/maintenance/pm-schedules/[id] — get PM schedule detail
 * PATCH /api/maintenance/pm-schedules/[id] — update PM schedule
 * DELETE /api/maintenance/pm-schedules/[id] — delete PM schedule
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getPmScheduleById,
  updatePmSchedule,
  deletePmSchedule,
} from '@/lib/services/pmScheduleService'

export const GET = withAuth(async ({ orgId, params }) => {
  const schedule = await getPmScheduleById(orgId, params.id)
  if (!schedule) {
    return NextResponse.json(fail('NOT_FOUND', 'PM schedule not found'), { status: 404 })
  }
  return NextResponse.json(ok(schedule))
}, { permission: PERMISSIONS.ASSETS_READ })

export const PATCH = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()
  const schedule = await updatePmSchedule(orgId, params.id, body)
  return NextResponse.json(ok(schedule))
}, { permission: PERMISSIONS.ASSETS_UPDATE })

export const DELETE = withAuth(async ({ orgId, params }) => {
  await deletePmSchedule(orgId, params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ASSETS_DELETE })
