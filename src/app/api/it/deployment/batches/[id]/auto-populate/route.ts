/**
 * POST /api/it/deployment/batches/[id]/auto-populate — auto-populate a batch with devices
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { autoPopulateBatch } from '@/lib/services/itDeploymentService'

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

    const filters = {
      schoolId: body.schoolId || undefined,
      grade: body.grade || undefined,
      deviceType: body.deviceType || undefined,
    }

    const result = await runWithOrgContext(orgId, () =>
      autoPopulateBatch(id, filters)
    )

    return NextResponse.json(ok(result))
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
    console.error('[POST /api/it/deployment/batches/[id]/auto-populate]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
