/**
 * GET /api/it/tickets/:id/comments — list ticket activities
 * POST /api/it/tickets/:id/comments — add comment
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addITTicketComment } from '@/lib/services/itTicketService'
import { notifyITTicketComment } from '@/lib/services/itNotificationService'
import { prisma } from '@/lib/db'

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

export const POST = withAuth(async ({ req, ctx, orgId, params }) => {
  const body = await req.json()
  const { content, isInternal } = body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'content is required'), { status: 400 })
  }

  // Check permission based on comment type — done manually since it's conditional
  if (isInternal) {
    // withAuth's classifyError will handle the permission error → 403
    const { assertCan } = await import('@/lib/auth/permissions')
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_INTERNAL)
  } else {
    const { assertCan } = await import('@/lib/auth/permissions')
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER)
  }

  const activity = await addITTicketComment(params.id, content.trim(), !!isInternal, { userId: ctx.userId })

  // Fire-and-forget comment notification (public comments only)
  if (!isInternal) {
    const ticket = await prisma.iTTicket.findUnique({
      where: { id: params.id },
      include: {
        submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    })
    if (ticket) {
      notifyITTicketComment(ticket, ctx.userId, content.trim(), orgId)
    }
  }

  return NextResponse.json(ok(activity), { status: 201 })
})
