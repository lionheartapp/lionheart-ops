import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getOrphanedAccounts } from '@/lib/services/itProvisioningService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_PROVISIONING_VIEW)

    const resolved = req.nextUrl.searchParams.get('resolved')

    return await runWithOrgContext(orgId, async () => {
      const accounts = await getOrphanedAccounts({
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      })
      return NextResponse.json(ok(accounts))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/provisioning/orphaned]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
