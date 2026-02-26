import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getTicketWithMessages, addSupportMessage } from '@/lib/services/platformSupportService'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req) // verify auth
    const { id } = await params

    const ticket = await getTicketWithMessages(id)
    if (!ticket || ticket.organizationId !== orgId) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    return NextResponse.json(ok(ticket))
  } catch (error) {
    console.error('[GET /api/support-tickets/platform/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params

    // Verify ticket belongs to this org
    const ticket = await getTicketWithMessages(id)
    if (!ticket || ticket.organizationId !== orgId) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    const body = await req.json()
    if (!body.message?.trim()) {
      return NextResponse.json(fail('BAD_REQUEST', 'message is required'), { status: 400 })
    }

    const message = await addSupportMessage({
      ticketId: id,
      senderId: ctx.userId,
      senderType: 'ORG_USER',
      message: body.message.trim(),
    })

    return NextResponse.json(ok(message), { status: 201 })
  } catch (error) {
    console.error('[POST /api/support-tickets/platform/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
