/**
 * GET   /api/it/deployment/batches/[id] — get batch detail
 * PATCH /api/it/deployment/batches/[id] — update batch status (start / complete / cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getBatchDetail,
  startBatch,
  completeBatch,
  cancelBatch,
} from '@/lib/services/itDeploymentService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEPLOYMENT_MANAGE)

    const { id } = await params

    const batch = await runWithOrgContext(orgId, () => getBatchDetail(id))

    return NextResponse.json(ok(batch))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Batch not found') {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
    }
    console.error('[GET /api/it/deployment/batches/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEPLOYMENT_MANAGE)

    const { id } = await params
    const body = await req.json()
    const action = body.action as string

    if (!['start', 'complete', 'cancel'].includes(action)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'action must be one of: start, complete, cancel'),
        { status: 400 }
      )
    }

    const result = await runWithOrgContext(orgId, async () => {
      switch (action) {
        case 'start':
          return startBatch(id)
        case 'complete':
          return completeBatch(id)
        case 'cancel':
          return cancelBatch(id)
        default:
          throw new Error('Invalid action')
      }
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Batch not found') {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
      if (error.message.includes('not in progress') || error.message.includes('Can only')) {
        return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
      }
    }
    console.error('[PATCH /api/it/deployment/batches/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
