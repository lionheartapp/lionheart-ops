/**
 * GET /api/maintenance/compliance/records — list compliance records with optional filters
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getComplianceRecords } from '@/lib/services/complianceService'
import type { ComplianceDomain, ComplianceStatus } from '@prisma/client'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const domain = searchParams.get('domain') as ComplianceDomain | null
  const status = searchParams.get('status') as ComplianceStatus | null
  const schoolId = searchParams.get('schoolId')
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined

  const records = await getComplianceRecords(orgId, {
    ...(domain && { domain }),
    ...(status && { status }),
    ...(schoolId && { schoolId }),
    ...(from && { from }),
    ...(to && { to }),
  })
  return NextResponse.json(ok(records))
}, { permission: PERMISSIONS.COMPLIANCE_READ })
