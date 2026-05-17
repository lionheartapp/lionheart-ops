/**
 * POST /api/tickets/[ticketCode]/verify — Check in a ticket (mark as USED)
 * GET  /api/tickets/[ticketCode]/verify — Check ticket status without marking
 *
 * Used by the check-in scanner. POST requires auth (staff scanning at door).
 * GET is used by the QR code redirect to show ticket status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- ticket verify uses rawPrisma for public GET + auth POST
import { rawPrisma } from '@/lib/db'
import { getUserContext } from '@/lib/request-context'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const { ticketCode } = await params

  const ticket = await rawPrisma.eventTicket.findUnique({
    where: { ticketCode },
    select: { status: true, ticketCode: true, checkedInAt: true },
  })

  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }

  return NextResponse.json(ok({
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
  }))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const { ticketCode } = await params

  // Require auth for check-in
  let userId: string | null = null
  try {
    const ctx = await getUserContext(req)
    userId = ctx.userId
  } catch {
    return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
  }

  const ticket = await rawPrisma.eventTicket.findUnique({
    where: { ticketCode },
    include: {
      ticketType: { select: { name: true } },
      order: { select: { buyerName: true } },
    },
  })

  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }

  if (ticket.status === 'USED') {
    return NextResponse.json(ok({
      status: 'ALREADY_USED',
      ticketCode: ticket.ticketCode,
      buyerName: ticket.order.buyerName,
      ticketType: ticket.ticketType.name,
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    }))
  }

  if (ticket.status === 'CANCELLED') {
    return NextResponse.json(ok({
      status: 'CANCELLED',
      ticketCode: ticket.ticketCode,
      buyerName: ticket.order.buyerName,
      ticketType: ticket.ticketType.name,
    }))
  }

  // Mark as used
  const updated = await rawPrisma.eventTicket.update({
    where: { ticketCode },
    data: {
      status: 'USED',
      checkedInAt: new Date(),
      checkedInBy: userId,
    },
  })

  return NextResponse.json(ok({
    status: 'CHECKED_IN',
    ticketCode: updated.ticketCode,
    buyerName: ticket.order.buyerName,
    ticketType: ticket.ticketType.name,
    checkedInAt: updated.checkedInAt?.toISOString() ?? null,
  }))
}
