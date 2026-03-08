/**
 * GET /api/it/sync/jobs/[id] — sync job detail
 */
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getJob } from '@/lib/services/itSyncJobService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_SYNC)
    const job = await runWithOrgContext(orgId, () => getJob(id))
    if (!job) return NextResponse.json(fail('NOT_FOUND', 'Job not found'), { status: 404 })
    return NextResponse.json(ok(job))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions'))
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    console.error('[GET /api/it/sync/jobs/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
