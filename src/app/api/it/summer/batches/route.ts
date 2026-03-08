/**
 * GET  /api/it/summer/batches — list summer batches
 * POST /api/it/summer/batches — create a summer batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listSummerBatches,
  createSummerBatch,
  CreateSummerBatchSchema,
} from '@/lib/services/itSummerService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const url = new URL(req.url)
    const filters = {
      batchType: url.searchParams.get('batchType') || undefined,
      status: url.searchParams.get('status') || undefined,
    }

    const batches = await runWithOrgContext(orgId, () => listSummerBatches(filters))

    return NextResponse.json(ok(batches))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/summer/batches]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const body = await req.json()
    const validated = CreateSummerBatchSchema.parse(body)

    const batch = await runWithOrgContext(orgId, () =>
      createSummerBatch(validated, ctx.userId)
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
    console.error('[POST /api/it/summer/batches]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
