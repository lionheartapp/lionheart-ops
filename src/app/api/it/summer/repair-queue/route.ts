/**
 * GET /api/it/summer/repair-queue — get repair queue items
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getRepairQueue } from '@/lib/services/itSummerService'

export const GET = withAuth(async ({ searchParams }) => {
  const filters = {
    queueStatus: searchParams.get('queueStatus') || undefined,
  }

  const queue = await getRepairQueue(filters)

  return NextResponse.json(ok(queue))
}, { permission: PERMISSIONS.IT_REPAIR_QUEUE_MANAGE })
