/**
 * GET /api/maintenance/compliance/records — list compliance records with optional filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getComplianceRecords } from '@/lib/services/complianceService'
import type { ComplianceDomain, ComplianceStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_READ)

    const sp = req.nextUrl.searchParams
    const domain = sp.get('domain') as ComplianceDomain | null
    const status = sp.get('status') as ComplianceStatus | null
    const schoolId = sp.get('schoolId')
    const from = sp.get('from') ? new Date(sp.get('from')!) : undefined
    const to = sp.get('to') ? new Date(sp.get('to')!) : undefined

    return await runWithOrgContext(orgId, async () => {
      const records = await getComplianceRecords(orgId, {
        ...(domain && { domain }),
        ...(status && { status }),
        ...(schoolId && { schoolId }),
        ...(from && { from }),
        ...(to && { to }),
      })
      return NextResponse.json(ok(records))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/compliance/records]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
