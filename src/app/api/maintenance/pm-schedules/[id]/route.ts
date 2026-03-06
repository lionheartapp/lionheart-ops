/**
 * GET /api/maintenance/pm-schedules/[id] — get PM schedule detail
 * PATCH /api/maintenance/pm-schedules/[id] — update PM schedule
 * DELETE /api/maintenance/pm-schedules/[id] — delete PM schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getPmScheduleById,
  updatePmSchedule,
  deletePmSchedule,
} from '@/lib/services/pmScheduleService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_READ)

    const schedule = await runWithOrgContext(orgId, () => getPmScheduleById(orgId, id))
    if (!schedule) {
      return NextResponse.json(fail('NOT_FOUND', 'PM schedule not found'), { status: 404 })
    }

    return NextResponse.json(ok(schedule))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/pm-schedules/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_UPDATE)

    const body = await req.json()

    const schedule = await runWithOrgContext(orgId, () => updatePmSchedule(orgId, id, body))
    return NextResponse.json(ok(schedule))
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
    console.error('[PATCH /api/maintenance/pm-schedules/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_DELETE)

    await runWithOrgContext(orgId, () => deletePmSchedule(orgId, id))
    return NextResponse.json(ok({ deleted: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[DELETE /api/maintenance/pm-schedules/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
