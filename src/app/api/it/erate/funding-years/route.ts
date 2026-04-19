/**
 * GET /api/it/erate/funding-years — rolled-up funding-year cards for the
 * current org, optionally filtered by BEN.
 *
 *   ?ben=123456   filter to a single BEN (otherwise returns all of the org's
 *                 ENS rolled-up rows; useful for districts that file under
 *                 multiple BENs).
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listFundingYears } from '@/lib/services/it/erate-sync'

export const GET = withAuth(
  async ({ orgId, searchParams }) => {
    const ben = searchParams.get('ben') || undefined
    const years = await listFundingYears(orgId, ben)
    return NextResponse.json(ok(years))
  },
  { permission: PERMISSIONS.IT_ERATE_VIEW }
)
