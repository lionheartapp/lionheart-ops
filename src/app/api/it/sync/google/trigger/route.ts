/**
 * POST /api/it/sync/google/trigger — manual Google Admin Chromebook sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { syncChromebooks } from '@/lib/services/googleAdminService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_SYNC)

    const result = await runWithOrgContext(orgId, () =>
      syncChromebooks(orgId)
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.includes('not configured') || error.message.includes('not enabled')) {
        return NextResponse.json(fail('CONFIGURATION_ERROR', error.message), { status: 422 })
      }
    }
    console.error('[POST /api/it/sync/google/trigger]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
