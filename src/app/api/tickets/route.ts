import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as ticketService from '@/lib/services/ticketService'
import { embedTicket } from '@/lib/services/ai/embeddingTriggers'
import { parsePagination, paginationMeta } from '@/lib/pagination'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)
  const status = searchParams.get('status') || undefined
  const category = searchParams.get('category') || undefined
  const priority = searchParams.get('priority') || undefined
  const assignedToId = searchParams.get('assignedToId') || undefined
  const schoolId = searchParams.get('schoolId') || undefined
  const search = searchParams.get('search') || undefined

  const filters = { limit, skip, status: status as any, category: category as any, priority: priority as any, assignedToId, schoolId, search }

  const [total, tickets] = await Promise.all([
    ticketService.countTickets(filters, ctx.userId),
    ticketService.listTickets(filters, ctx.userId),
  ])

  return NextResponse.json(ok(tickets, paginationMeta(total, { page, limit, skip })))
})

export const POST = withAuth(async ({ req, ctx }) => {
  const body = await req.json()

  const ticket = await ticketService.createTicket(body, ctx.userId)

  void embedTicket(ticket.id, {
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
  })

  return NextResponse.json(ok(ticket), { status: 201 })
})
