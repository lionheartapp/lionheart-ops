/**
 * POST /api/it/summer/batches/[id]/items — add devices to a summer batch
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addDevicesToSummerBatch } from '@/lib/services/itSummerService'

export const POST = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const { deviceIds } = body as { deviceIds: string[] }

  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'deviceIds must be a non-empty array'),
      { status: 400 }
    )
  }

  const result = await addDevicesToSummerBatch(params.id, deviceIds)

  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })
