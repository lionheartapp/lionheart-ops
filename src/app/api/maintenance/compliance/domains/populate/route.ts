/**
 * POST /api/maintenance/compliance/domains/populate — populate compliance calendar for current school year
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { populateComplianceCalendar } from '@/lib/services/complianceService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      // Compute current school year: Aug 1 – Jul 31
      const now = new Date()
      const schoolYearStart = now.getMonth() >= 7
        ? new Date(now.getFullYear(), 7, 1) // Aug 1 this year
        : new Date(now.getFullYear() - 1, 7, 1) // Aug 1 last year
      const schoolYearEnd = new Date(schoolYearStart.getFullYear() + 1, 6, 31) // Jul 31 next year

      const createdCount = await populateComplianceCalendar(orgId, schoolYearStart, schoolYearEnd)

      return NextResponse.json(ok({ createdCount, schoolYearStart, schoolYearEnd }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/maintenance/compliance/domains/populate]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
