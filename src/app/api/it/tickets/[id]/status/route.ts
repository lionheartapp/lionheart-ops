/**
 * PATCH /api/it/tickets/:id/status — transition IT ticket status
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { transitionITTicketStatus } from '@/lib/services/itTicketService'
import { notifyITStatusChange } from '@/lib/services/itNotificationService'

const TransitionStatusSchema = z.object({
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED']),
  holdReason: z.enum(['PARTS', 'VENDOR', 'USER_AVAILABILITY', 'THIRD_PARTY', 'OTHER']).optional(),
  holdNote: z.string().max(2000).optional(),
  resolutionNote: z.string().max(2000).optional(),
  cancellationReason: z.string().max(2000).optional(),
  comment: z.string().max(5000).optional(),
})

export const PATCH = withAuth(async ({ body, ctx, orgId, params }) => {
  const ticket = await transitionITTicketStatus(params.id, body.status, {
    holdReason: body.holdReason,
    holdNote: body.holdNote,
    resolutionNote: body.resolutionNote,
    cancellationReason: body.cancellationReason,
    comment: body.comment,
  }, { userId: ctx.userId, orgId })

  // Fire-and-forget notification
  notifyITStatusChange(ticket, body.status, orgId)

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.IT_TICKET_UPDATE_STATUS, schema: TransitionStatusSchema })
