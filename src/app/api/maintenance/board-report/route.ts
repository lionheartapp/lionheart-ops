/**
 * GET /api/maintenance/board-report
 *
 * Returns BoardReportMetrics for the specified date range and optional campus.
 * Permission: MAINTENANCE_VIEW_ANALYTICS
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getBoardReportMetrics } from '@/lib/services/boardReportService'

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  schoolId: z.string().optional(),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const parsed = QuerySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    schoolId: searchParams.get('schoolId') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.issues.map((e) => e.message)),
      { status: 400 }
    )
  }

  const { from, to, schoolId } = parsed.data
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T23:59:59.999Z`)

  if (fromDate > toDate) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'from must be before to'),
      { status: 400 }
    )
  }

  const metrics = await getBoardReportMetrics(orgId, {
    from: fromDate,
    to: toDate,
    campusId: schoolId,
  })
  return NextResponse.json(ok(metrics))
}, { permission: PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS })
