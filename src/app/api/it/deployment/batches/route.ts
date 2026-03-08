/**
 * GET  /api/it/deployment/batches — list deployment batches (filterable)
 * POST /api/it/deployment/batches — create a new deployment/collection batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listBatches,
  createBatch,
  CreateBatchSchema,
} from '@/lib/services/itDeploymentService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEPLOYMENT_MANAGE)

    const url = new URL(req.url)
    const filters = {
      batchType: url.searchParams.get('batchType') || undefined,
      status: url.searchParams.get('status') || undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
    }

    const result = await runWithOrgContext(orgId, () => listBatches(filters))

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/deployment/batches]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEPLOYMENT_MANAGE)

    const body = await req.json()
    const validated = CreateBatchSchema.parse(body)

    const batch = await runWithOrgContext(orgId, () =>
      createBatch(validated, ctx.userId)
    )

    return NextResponse.json(ok(batch), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/deployment/batches]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
