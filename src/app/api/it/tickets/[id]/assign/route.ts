/**
 * PATCH /api/it/tickets/:id/assign — assign IT ticket
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { assignITTicket } from '@/lib/services/itTicketService'
import { notifyITTicketAssigned } from '@/lib/services/itNotificationService'

const AssignSchema = z.object({
  assignedToId: z.string().uuid('assignedToId must be a valid UUID'),
})

export const PATCH = withAuth(async ({ body, ctx, orgId, params }) => {
  const ticket = await assignITTicket(params.id, body.assignedToId, { userId: ctx.userId, orgId })

  // Fire-and-forget notification
  notifyITTicketAssigned(ticket, body.assignedToId, orgId)

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.IT_TICKET_ASSIGN, schema: AssignSchema })
