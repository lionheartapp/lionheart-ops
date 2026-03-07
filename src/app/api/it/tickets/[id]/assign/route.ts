/**
 * PATCH /api/it/tickets/:id/assign — assign IT ticket
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { assignITTicket } from '@/lib/services/itTicketService'
import { notifyITTicketAssigned } from '@/lib/services/itNotificationService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_ASSIGN)
    const { id } = await params
    const body = await req.json()

    if (!body.assignedToId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'assignedToId is required'), { status: 400 })
    }

    const ticket = await runWithOrgContext(orgId, () =>
      assignITTicket(id, body.assignedToId, { userId: ctx.userId, orgId })
    )

    // Fire-and-forget notification
    notifyITTicketAssigned(ticket, body.assignedToId, orgId)

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'TICKET_NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
    }
    console.error('[PATCH /api/it/tickets/:id/assign]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
