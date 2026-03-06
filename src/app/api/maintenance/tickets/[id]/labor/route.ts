/**
 * GET  /api/maintenance/tickets/[id]/labor  — list labor entries
 * POST /api/maintenance/tickets/[id]/labor  — create labor entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getLaborEntries, createLaborEntry } from '@/lib/services/laborCostService'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    const entries = await runWithOrgContext(orgId, () => getLaborEntries(ticketId))
    return NextResponse.json(ok(entries))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/tickets/[id]/labor]', error)
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

    // Default technicianId to current user if not specified
    if (!body.technicianId) {
      body.technicianId = ctx.userId
    }

    let entry
    try {
      entry = await runWithOrgContext(orgId, () =>
        createLaborEntry(orgId, ticketId, body)
      )
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('VALIDATION_ERROR')) {
        return NextResponse.json(fail('VALIDATION_ERROR', err.message), { status: 400 })
      }
      throw err
    }

    return NextResponse.json(ok(entry), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('ZodError')) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input'), { status: 400 })
    }
    console.error('[POST /api/maintenance/tickets/[id]/labor]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
