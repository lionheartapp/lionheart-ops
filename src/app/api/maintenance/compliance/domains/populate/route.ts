/**
 * POST /api/maintenance/compliance/domains/populate — populate compliance calendar for current school year
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { populateComplianceCalendar } from '@/lib/services/complianceService'

export const POST = withAuth(async ({ orgId }) => {
  // Compute current school year: Aug 1 – Jul 31
  const now = new Date()
  const schoolYearStart = now.getMonth() >= 7
    ? new Date(now.getFullYear(), 7, 1) // Aug 1 this year
    : new Date(now.getFullYear() - 1, 7, 1) // Aug 1 last year
  const schoolYearEnd = new Date(schoolYearStart.getFullYear() + 1, 6, 31) // Jul 31 next year

  const createdCount = await populateComplianceCalendar(orgId, schoolYearStart, schoolYearEnd)

  return NextResponse.json(ok({ createdCount, schoolYearStart, schoolYearEnd }))
}, { permission: PERMISSIONS.COMPLIANCE_MANAGE })
