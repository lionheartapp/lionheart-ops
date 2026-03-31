/**
 * GET  /api/it/deployment/batches — list deployment batches (filterable)
 * POST /api/it/deployment/batches — create a new deployment/collection batch
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listBatches,
  createBatch,
  CreateBatchSchema,
} from '@/lib/services/itDeploymentService'

export const GET = withAuth(async ({ searchParams }) => {
  const filters = {
    batchType: searchParams.get('batchType') || undefined,
    status: searchParams.get('status') || undefined,
    schoolId: searchParams.get('schoolId') || undefined,
  }

  const result = await listBatches(filters)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEPLOYMENT_MANAGE })

export const POST = withAuth(async ({ body, ctx }) => {
  const batch = await createBatch(body, ctx.userId)
  return NextResponse.json(ok(batch), { status: 201 })
}, { permission: PERMISSIONS.IT_DEPLOYMENT_MANAGE, schema: CreateBatchSchema })
