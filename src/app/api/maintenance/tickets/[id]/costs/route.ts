/**
 * GET  /api/maintenance/tickets/[id]/costs  — list cost entries
 * POST /api/maintenance/tickets/[id]/costs  — create cost entry
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getCostEntries, createCostEntry, getCostSummary } from '@/lib/services/laborCostService'

export const GET = withAuth(async ({ orgId, params, searchParams }) => {
  const ticketId = params.id
  const includeSummary = searchParams.get('summary') === 'true'

  const [entries, summary] = await Promise.all([
    getCostEntries(ticketId),
    includeSummary ? getCostSummary(ticketId) : Promise.resolve(null),
  ])

  return NextResponse.json(ok({ entries, summary }))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })

export const POST = withAuth(async ({ req, orgId, ctx, params }) => {
  const ticketId = params.id
  const body = await req.json()

  try {
    const entry = await createCostEntry(orgId, ticketId, ctx.userId, body)
    return NextResponse.json(ok(entry), { status: 201 })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ZodError') || err.name === 'ZodError')) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input'), { status: 400 })
    }
    throw err
  }
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
