/**
 * POST /api/it/deployment/batches/[id]/devices — add devices to a batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { addDevicesToBatch } from '@/lib/services/itDeploymentService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEPLOYMENT_MANAGE)

    const { id } = await params
    const body = await req.json()

    if (!Array.isArray(body.deviceIds) || body.deviceIds.length === 0) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'deviceIds must be a non-empty array of strings'),
        { status: 400 }
      )
    }

    const result = await runWithOrgContext(orgId, () =>
      addDevicesToBatch(id, body.deviceIds)
    )

    return NextResponse.json(ok(result), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Batch not found') {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
      if (error.message.includes('DRAFT')) {
        return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
      }
    }
    console.error('[POST /api/it/deployment/batches/[id]/devices]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
