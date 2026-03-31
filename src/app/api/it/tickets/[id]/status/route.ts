/**
 * PATCH /api/it/tickets/:id/status — transition IT ticket status
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { transitionITTicketStatus } from '@/lib/services/itTicketService'
import { notifyITStatusChange } from '@/lib/services/itNotificationService'

export const PATCH = withAuth(async ({ req, ctx, orgId, params }) => {
  const body = await req.json()

  const { status, holdReason, holdNote, resolutionNote, cancellationReason, comment } = body

  if (!status) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'status is required'), { status: 400 })
  }

  const ticket = await transitionITTicketStatus(params.id, status, {
    holdReason,
    holdNote,
    resolutionNote,
    cancellationReason,
    comment,
  }, { userId: ctx.userId, orgId })

  // Fire-and-forget notification
  notifyITStatusChange(ticket, status, orgId)

  return NextResponse.json(ok(ticket))
})
