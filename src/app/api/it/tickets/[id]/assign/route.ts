/**
 * PATCH /api/it/tickets/:id/assign — assign IT ticket
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { assignITTicket } from '@/lib/services/itTicketService'
import { notifyITTicketAssigned } from '@/lib/services/itNotificationService'

export const PATCH = withAuth(async ({ req, ctx, orgId, params }) => {
  const body = await req.json()

  if (!body.assignedToId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'assignedToId is required'), { status: 400 })
  }

  const ticket = await assignITTicket(params.id, body.assignedToId, { userId: ctx.userId, orgId })

  // Fire-and-forget notification
  notifyITTicketAssigned(ticket, body.assignedToId, orgId)

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.IT_TICKET_ASSIGN })
