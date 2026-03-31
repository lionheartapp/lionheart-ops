/**
 * POST /api/it/deployment/batches/[id]/devices — add devices to a batch
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addDevicesToBatch } from '@/lib/services/itDeploymentService'

export const POST = withAuth(async ({ req, params }) => {
  const body = await req.json()

  if (!Array.isArray(body.deviceIds) || body.deviceIds.length === 0) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'deviceIds must be a non-empty array of strings'),
      { status: 400 }
    )
  }

  const result = await addDevicesToBatch(params.id, body.deviceIds)
  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.IT_DEPLOYMENT_MANAGE })
