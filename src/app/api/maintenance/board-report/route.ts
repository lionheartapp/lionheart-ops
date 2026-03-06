/**
 * GET /api/maintenance/board-report
 *
 * Returns BoardReportMetrics for the specified date range and optional campus.
 * Permission: MAINTENANCE_VIEW_ANALYTICS
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import { PERMISSIONS } from '@/lib/permissions'
import { getBoardReportMetrics } from '@/lib/services/boardReportService'

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  schoolId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS)

    const { searchParams } = new URL(req.url)
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

    return await runWithOrgContext(orgId, async () => {
      const metrics = await getBoardReportMetrics(orgId, {
        from: fromDate,
        to: toDate,
        schoolId,
      })
      return NextResponse.json(ok(metrics))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/board-report]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
