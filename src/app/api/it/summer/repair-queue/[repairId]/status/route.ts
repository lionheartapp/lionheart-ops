/**
 * PATCH /api/it/summer/repair-queue/[repairId]/status — update repair queue item status
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateRepairQueueStatus } from '@/lib/services/itSummerService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ repairId: string }> }
) {
  try {
    const { repairId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE)

    const body = await req.json()
    const { status } = body as { status: string }

    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'status is required'),
        { status: 400 }
      )
    }

    const result = await runWithOrgContext(orgId, () =>
      updateRepairQueueStatus(repairId, status)
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[PATCH /api/it/summer/repair-queue/[repairId]/status]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
