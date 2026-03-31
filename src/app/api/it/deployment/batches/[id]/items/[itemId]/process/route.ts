/**
 * POST /api/it/deployment/batches/[id]/items/[itemId]/process — process a single batch item
 *
 * For DEPLOYMENT batches: assigns the device to a student
 * For COLLECTION batches: records condition assessment and returns the device
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getBatchDetail,
  processDeploymentItem,
  processCollectionItem,
  ProcessDeploymentItemSchema,
  ProcessCollectionItemSchema,
} from '@/lib/services/itDeploymentService'

export const POST = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json()

  // Look up the batch to determine the type
  const batch = await getBatchDetail(params.id)

  if (batch.batchType === 'DEPLOYMENT') {
    const validated = ProcessDeploymentItemSchema.parse(body)
    const result = await processDeploymentItem(params.itemId, validated, ctx.userId)
    return NextResponse.json(ok(result))
  } else {
    const validated = ProcessCollectionItemSchema.parse(body)
    const result = await processCollectionItem(params.itemId, validated, ctx.userId)
    return NextResponse.json(ok(result))
  }
}, { permission: PERMISSIONS.IT_DEPLOYMENT_PROCESS })
