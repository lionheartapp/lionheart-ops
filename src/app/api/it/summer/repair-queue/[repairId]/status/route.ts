/**
 * PATCH /api/it/summer/repair-queue/[repairId]/status — update repair queue item status
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateRepairQueueStatus } from '@/lib/services/itSummerService'

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const { status } = body as { status: string }

  if (!status || typeof status !== 'string') {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'status is required'),
      { status: 400 }
    )
  }

  const result = await updateRepairQueueStatus(params.repairId, status)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_REPAIR_QUEUE_MANAGE })
