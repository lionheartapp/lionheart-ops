import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getRepairReplaceSummary } from '@/lib/services/itBoardReportService'

export const GET = withAuth(async ({ orgId }) => {
  const data = await getRepairReplaceSummary(orgId)
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_REPORTS_BOARD })
