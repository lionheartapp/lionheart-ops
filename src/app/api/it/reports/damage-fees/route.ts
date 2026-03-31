import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getDamageFeeCollection } from '@/lib/services/itBoardReportService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const schoolId = searchParams.get('schoolId') || undefined

  const data = await getDamageFeeCollection(orgId, { schoolId })
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_REPORTS_BOARD })
