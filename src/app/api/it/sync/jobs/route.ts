/**
 * GET /api/it/sync/jobs — sync job history
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { listJobs } from '@/lib/services/itSyncJobService'
import type { SyncJobStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_SYNC)

    const url = new URL(req.url)
    const filters = {
      provider: url.searchParams.get('provider') || undefined,
      jobType: url.searchParams.get('jobType') || undefined,
      status: (url.searchParams.get('status') || undefined) as SyncJobStatus | undefined,
      configId: url.searchParams.get('configId') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
    }

    const result = await runWithOrgContext(orgId, () => listJobs(filters))

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/sync/jobs]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
