import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getTicketWithMessages, addSupportMessage } from '@/lib/services/platformSupportService'
import { logger } from '@/lib/logger'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * @authOnly Users can read or reply to their own support tickets; workspace managers can access all org support tickets.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params

    const ticket = await getTicketWithMessages(id)
    const canManageWorkspace = await can(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)
    if (
      !ticket ||
      ticket.organizationId !== orgId ||
      (!canManageWorkspace && ticket.submittedByUserId !== ctx.userId)
    ) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    return NextResponse.json(ok(ticket))
  } catch (error) {
    logger.error({ error: String(error) }, 'Failed to get support ticket')
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
    const canManageWorkspace = await can(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)
    if (
      !ticket ||
      ticket.organizationId !== orgId ||
      (!canManageWorkspace && ticket.submittedByUserId !== ctx.userId)
    ) {
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
    logger.error({ error: String(error) }, 'Failed to add support message')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
