/**
 * GET  /api/maintenance/tickets/[id]/costs  — list cost entries
 * POST /api/maintenance/tickets/[id]/costs  — create cost entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getCostEntries, createCostEntry, getCostSummary } from '@/lib/services/laborCostService'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    const url = new URL(req.url)
    const includeSummary = url.searchParams.get('summary') === 'true'

    const [entries, summary] = await Promise.all([
      runWithOrgContext(orgId, () => getCostEntries(ticketId)),
      includeSummary ? runWithOrgContext(orgId, () => getCostSummary(ticketId)) : Promise.resolve(null),
    ])

    return NextResponse.json(ok({ entries, summary }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/tickets/[id]/costs]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    const body = await req.json()

    let entry
    try {
      entry = await runWithOrgContext(orgId, () =>
        createCostEntry(orgId, ticketId, ctx.userId, body)
      )
    } catch (err) {
      if (err instanceof Error && (err.message.includes('ZodError') || err.name === 'ZodError')) {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input'), { status: 400 })
      }
      throw err
    }

    return NextResponse.json(ok(entry), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/maintenance/tickets/[id]/costs]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
