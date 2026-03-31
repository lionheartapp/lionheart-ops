import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as ticketService from '@/lib/services/ticketService'
import * as ticketCommentService from '@/lib/services/ticketCommentService'

export const GET = withAuth(async ({ ctx, params }) => {
  const ticket = await ticketService.getTicketById(params.id, ctx.userId)
  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }
  const comments = await ticketCommentService.listComments(params.id)
  return NextResponse.json(ok(comments))
})

export const POST = withAuth(async ({ req, ctx, params, orgId }) => {
  const ticket = await ticketService.getTicketById(params.id, ctx.userId)
  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }
  const body = await req.json()
  const comment = await ticketCommentService.createComment(params.id, ctx.userId, body, orgId)
  return NextResponse.json(ok(comment), { status: 201 })
})
