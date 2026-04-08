/**
 * GET /api/it/tickets/:id/comments — list ticket activities
 * POST /api/it/tickets/:id/comments — add comment
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addITTicketComment } from '@/lib/services/itTicketService'
import { notifyITTicketComment } from '@/lib/services/itNotificationService'
import { prisma } from '@/lib/db'

const CommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
  isInternal: z.boolean().default(false),
})

export const GET = withAuth(async ({ ctx, params, permissions }) => {
  const canSeeInternal = await permissions.can(PERMISSIONS.IT_TICKET_COMMENT_INTERNAL)

  const activities = await prisma.iTTicketActivity.findMany({
    where: {
      ticketId: params.id,
      ...(canSeeInternal ? {} : { isInternal: false }),
    },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(ok(activities))
}, { permission: PERMISSIONS.IT_TICKET_READ_OWN })

export const POST = withAuth(async ({ body, ctx, orgId, params }) => {
  // Check permission based on comment type — done manually since it's conditional
  if (body.isInternal) {
    const { assertCan } = await import('@/lib/auth/permissions')
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_INTERNAL)
  } else {
    const { assertCan } = await import('@/lib/auth/permissions')
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER)
  }

  const activity = await addITTicketComment(params.id, body.content.trim(), body.isInternal, { userId: ctx.userId })

  // Fire-and-forget comment notification (public comments only)
  if (!body.isInternal) {
    const ticket = await prisma.iTTicket.findUnique({
      where: { id: params.id },
      include: {
        submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    })
    if (ticket) {
      notifyITTicketComment(ticket, ctx.userId, body.content.trim(), orgId)
    }
  }

  return NextResponse.json(ok(activity), { status: 201 })
}, { schema: CommentSchema })
