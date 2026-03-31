/**
 * GET   /api/it/summer/batches/[id] — get batch detail
 * PATCH /api/it/summer/batches/[id] — update batch status (start/complete)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getSummerBatchDetail,
  startSummerBatch,
  completeSummerBatch,
} from '@/lib/services/itSummerService'

export const GET = withAuth(async ({ params }) => {
  const batch = await getSummerBatchDetail(params.id)

  if (!batch) {
    return NextResponse.json(fail('NOT_FOUND', 'Summer batch not found'), { status: 404 })
  }

  return NextResponse.json(ok(batch))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const { action } = body as { action: 'start' | 'complete' }

  if (action !== 'start' && action !== 'complete') {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'action must be "start" or "complete"'),
      { status: 400 }
    )
  }

  const result = action === 'start'
    ? await startSummerBatch(params.id)
    : await completeSummerBatch(params.id)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })
