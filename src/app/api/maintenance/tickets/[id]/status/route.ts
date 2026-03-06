/**
 * PATCH /api/maintenance/tickets/[id]/status — transition ticket status
 *
 * Enforces the ALLOWED_TRANSITIONS state machine.
 * Returns 400 INVALID_TRANSITION for disallowed moves.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { transitionTicketStatus } from '@/lib/services/maintenanceTicketService'
import type { MaintenanceTicketStatus, HoldReason } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const { status, holdReason, holdNote, completionNote, completionPhotos, cancellationReason, rejectionNote, comment } = body

    if (!status) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'status is required'), { status: 400 })
    }

    const updated = await runWithOrgContext(orgId, () =>
      transitionTicketStatus(
        id,
        status as MaintenanceTicketStatus,
        {
          holdReason: holdReason as HoldReason | undefined,
          holdNote,
          completionNote,
          completionPhotos,
          cancellationReason,
          rejectionNote,
          comment,
        },
        { userId: ctx.userId, organizationId: orgId }
      )
    )

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('INVALID_TRANSITION')) {
        return NextResponse.json(
          fail('INVALID_TRANSITION', error.message.replace('INVALID_TRANSITION: ', '')),
          { status: 400 }
        )
      }
      if (error.message.startsWith('MISSING_FIELD')) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', error.message.replace('MISSING_FIELD: ', '')),
          { status: 400 }
        )
      }
      if (error.message.startsWith('FORBIDDEN') || error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
      }
      if (error.message === 'TICKET_NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
    }
    console.error('[PATCH /api/maintenance/tickets/[id]/status]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
