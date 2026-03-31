/**
 * GET /api/events/projects/[id]/budget/report
 *
 * Budget vs actual report with per-participant cost analysis.
 * Syncs Stripe registration revenue before computing report totals.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { syncRegistrationRevenue, getBudgetReport } from '@/lib/services/budgetService'

export const GET = withAuth(async ({ params }) => {
  const { id: eventProjectId } = params

  // Sync Stripe revenue so report reflects latest payment data
  await syncRegistrationRevenue(eventProjectId)
  const report = await getBudgetReport(eventProjectId)
  return NextResponse.json(ok(report))
}, { permission: PERMISSIONS.EVENTS_BUDGET_READ })
