/**
 * GET /api/it/erate/frns — list Funding Request Numbers for the current org.
 *
 * Query params:
 *   ?ben=123456            filter to one BEN
 *   ?fundingYear=2026      filter to one FY (4-digit year)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listFrns } from '@/lib/services/it/erate-sync'

export const GET = withAuth(
  async ({ orgId, searchParams }) => {
    const ben = searchParams.get('ben') || undefined
    const fyParam = searchParams.get('fundingYear')
    let fundingYear: number | undefined
    if (fyParam) {
      const parsed = parseInt(fyParam, 10)
      if (!Number.isFinite(parsed) || parsed < 1998 || parsed > 2100) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'fundingYear must be a 4-digit year'),
          { status: 400 }
        )
      }
      fundingYear = parsed
    }
    const frns = await listFrns(orgId, { ben, fundingYear })
    return NextResponse.json(ok(frns))
  },
  { permission: PERMISSIONS.IT_ERATE_VIEW }
)
