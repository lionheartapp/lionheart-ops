/**
 * POST /api/it/deployment/batches/[id]/items/[itemId]/process — process a single batch item
 *
 * For DEPLOYMENT batches: assigns the device to a student
 * For COLLECTION batches: records condition assessment and returns the device
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getBatchDetail,
  processDeploymentItem,
  processCollectionItem,
  ProcessDeploymentItemSchema,
  ProcessCollectionItemSchema,
} from '@/lib/services/itDeploymentService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEPLOYMENT_PROCESS)

    const { id, itemId } = await params
    const body = await req.json()

    const result = await runWithOrgContext(orgId, async () => {
      // Look up the batch to determine the type
      const batch = await getBatchDetail(id)

      if (batch.batchType === 'DEPLOYMENT') {
        const validated = ProcessDeploymentItemSchema.parse(body)
        return processDeploymentItem(itemId, validated, ctx.userId)
      } else {
        const validated = ProcessCollectionItemSchema.parse(body)
        return processCollectionItem(itemId, validated, ctx.userId)
      }
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Batch not found' || error.message === 'Item not found') {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
      if (error.message.includes('not in progress')) {
        return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/deployment/batches/[id]/items/[itemId]/process]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
