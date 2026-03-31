import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getRefreshForecast } from '@/lib/services/itBoardReportService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const thresholdYears = parseInt(searchParams.get('thresholdYears') || '4', 10)

  const data = await getRefreshForecast(orgId, { thresholdYears })
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_REPORTS_BOARD })
