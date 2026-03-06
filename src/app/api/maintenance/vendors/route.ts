/**
 * GET /api/maintenance/vendors
 *
 * Returns distinct vendor strings from org's cost entries.
 * Optional ?q= param for prefix filtering (case-insensitive ILIKE).
 *
 * Used by CostEntryForm vendor autocomplete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getVendorList } from '@/lib/services/laborCostService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? undefined

    const vendors = await runWithOrgContext(orgId, () => getVendorList(orgId, q))
    return NextResponse.json(ok(vendors))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/vendors]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
