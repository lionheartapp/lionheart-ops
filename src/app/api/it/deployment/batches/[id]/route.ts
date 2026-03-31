/**
 * GET   /api/it/deployment/batches/[id] — get batch detail
 * PATCH /api/it/deployment/batches/[id] — update batch status (start / complete / cancel)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getBatchDetail,
  startBatch,
  completeBatch,
  cancelBatch,
} from '@/lib/services/itDeploymentService'

export const GET = withAuth(async ({ params }) => {
  const batch = await getBatchDetail(params.id)
  return NextResponse.json(ok(batch))
}, { permission: PERMISSIONS.IT_DEPLOYMENT_MANAGE })

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const action = body.action as string

  if (!['start', 'complete', 'cancel'].includes(action)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'action must be one of: start, complete, cancel'),
      { status: 400 }
    )
  }

  let result
  switch (action) {
    case 'start':
      result = await startBatch(params.id)
      break
    case 'complete':
      result = await completeBatch(params.id)
      break
    case 'cancel':
      result = await cancelBatch(params.id)
      break
    default:
      throw new Error('Invalid action')
  }

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEPLOYMENT_MANAGE })
