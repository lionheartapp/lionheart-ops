import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAnnualTechReport } from '@/lib/services/itBoardReportService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const from = searchParams.get('from')
    ? new Date(searchParams.get('from')!)
    : new Date(new Date().getFullYear(), 0, 1) // Jan 1 of current year
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to')!)
    : new Date()
  const schoolId = searchParams.get('schoolId') || undefined

  const data = await getAnnualTechReport(orgId, { from, to, schoolId })
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_REPORTS_BOARD })
