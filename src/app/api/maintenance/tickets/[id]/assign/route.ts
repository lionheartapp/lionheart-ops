/**
 * PATCH /api/maintenance/tickets/[id]/assign — reassign ticket
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assignTicket } from '@/lib/services/maintenanceTicketService'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const assignedToId = body.assignedToId as string
    if (!assignedToId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'assignedToId is required'), { status: 400 })
    }

    const updated = await runWithOrgContext(orgId, () =>
      assignTicket(id, assignedToId, ctx.userId, orgId)
    )

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'TICKET_NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
    }
    console.error('[PATCH /api/maintenance/tickets/[id]/assign]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
