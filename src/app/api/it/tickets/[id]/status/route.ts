/**
 * PATCH /api/it/tickets/:id/status — transition IT ticket status
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { transitionITTicketStatus } from '@/lib/services/itTicketService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params
    const body = await req.json()

    const { status, holdReason, holdNote, resolutionNote, cancellationReason, comment } = body

    if (!status) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'status is required'), { status: 400 })
    }

    const ticket = await runWithOrgContext(orgId, () =>
      transitionITTicketStatus(id, status, {
        holdReason,
        holdNote,
        resolutionNote,
        cancellationReason,
        comment,
      }, { userId: ctx.userId, orgId })
    )

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.startsWith('INVALID_TRANSITION')) {
        return NextResponse.json(fail('INVALID_TRANSITION', error.message), { status: 400 })
      }
      if (error.message.startsWith('MISSING_FIELD')) {
        return NextResponse.json(fail('MISSING_FIELD', error.message), { status: 400 })
      }
      if (error.message === 'TICKET_NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
    }
    console.error('[PATCH /api/it/tickets/:id/status]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
