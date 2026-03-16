/**
 * GET /api/events/projects/[id]/budget/report
 *
 * Budget vs actual report with per-participant cost analysis.
 * Syncs Stripe registration revenue before computing report totals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { syncRegistrationRevenue, getBudgetReport } from '@/lib/services/budgetService'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_READ)

    return await runWithOrgContext(orgId, async () => {
      // Sync Stripe revenue so report reflects latest payment data
      await syncRegistrationRevenue(eventProjectId)
      const report = await getBudgetReport(eventProjectId)
      return NextResponse.json(ok(report))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
