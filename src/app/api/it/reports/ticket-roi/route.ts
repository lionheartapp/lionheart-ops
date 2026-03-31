import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTicketROINarrative } from '@/lib/services/itBoardReportService'

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const { from, to, schoolId } = body as { from?: string; to?: string; schoolId?: string }

  const data = await getTicketROINarrative(orgId, { from, to, schoolId })
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_REPORTS_BOARD })
