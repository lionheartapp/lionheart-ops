import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as ticketService from '@/lib/services/ticketService'

export const GET = withAuth(async ({ ctx, params }) => {
  const ticket = await ticketService.getTicketById(params.id, ctx.userId)
  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }
  return NextResponse.json(ok(ticket))
})

export const PUT = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json()
  const ticket = await ticketService.updateTicket(params.id, body, ctx.userId)
  return NextResponse.json(ok(ticket))
})

export const DELETE = withAuth(async ({ ctx, params }) => {
  await ticketService.deleteTicket(params.id, ctx.userId)
  return NextResponse.json(ok({ deleted: true }))
})
