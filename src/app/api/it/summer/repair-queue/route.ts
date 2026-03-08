/**
 * GET /api/it/summer/repair-queue — get repair queue items
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getRepairQueue } from '@/lib/services/itSummerService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE)

    const url = new URL(req.url)
    const filters = {
      queueStatus: url.searchParams.get('queueStatus') || undefined,
    }

    const queue = await runWithOrgContext(orgId, () => getRepairQueue(filters))

    return NextResponse.json(ok(queue))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/summer/repair-queue]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
