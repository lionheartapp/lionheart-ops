/**
 * GET  /api/it/summer/batches — list summer batches
 * POST /api/it/summer/batches — create a summer batch
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listSummerBatches,
  createSummerBatch,
  CreateSummerBatchSchema,
} from '@/lib/services/itSummerService'

export const GET = withAuth(async ({ searchParams }) => {
  const filters = {
    batchType: searchParams.get('batchType') || undefined,
    status: searchParams.get('status') || undefined,
  }

  const batches = await listSummerBatches(filters)

  return NextResponse.json(ok(batches))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })

export const POST = withAuth(async ({ ctx, body }) => {
  const batch = await createSummerBatch(body, ctx.userId)

  return NextResponse.json(ok(batch), { status: 201 })
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE, schema: CreateSummerBatchSchema })
