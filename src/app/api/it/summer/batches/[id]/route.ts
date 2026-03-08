/**
 * GET   /api/it/summer/batches/[id] — get batch detail
 * PATCH /api/it/summer/batches/[id] — update batch status (start/complete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getSummerBatchDetail,
  startSummerBatch,
  completeSummerBatch,
} from '@/lib/services/itSummerService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const batch = await runWithOrgContext(orgId, () => getSummerBatchDetail(id))

    if (!batch) {
      return NextResponse.json(fail('NOT_FOUND', 'Summer batch not found'), { status: 404 })
    }

    return NextResponse.json(ok(batch))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/summer/batches/[id]]', error)
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
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const body = await req.json()
    const { action } = body as { action: 'start' | 'complete' }

    if (action !== 'start' && action !== 'complete') {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'action must be "start" or "complete"'),
        { status: 400 }
      )
    }

    const result = await runWithOrgContext(orgId, async () => {
      if (action === 'start') {
        return startSummerBatch(id)
      } else {
        return completeSummerBatch(id)
      }
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[PATCH /api/it/summer/batches/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
