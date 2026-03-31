import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as ticketService from '@/lib/services/ticketService'
import * as ticketAttachmentService from '@/lib/services/ticketAttachmentService'

export const GET = withAuth(async ({ ctx, params }) => {
  const ticket = await ticketService.getTicketById(params.id, ctx.userId)
  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }
  const attachments = await ticketAttachmentService.listAttachments(params.id)
  return NextResponse.json(ok(attachments))
})

export const POST = withAuth(async ({ req, ctx, params, orgId }) => {
  const ticket = await ticketService.getTicketById(params.id, ctx.userId)
  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }
  const body = await req.json()
  try {
    const attachment = await ticketAttachmentService.createAttachment(params.id, ctx.userId, body, orgId)
    return NextResponse.json(ok(attachment), { status: 201 })
  } catch (error) {
    // File validation errors from service layer → 400 instead of 500
    if (error instanceof Error && (
      error.message.includes('File type') ||
      error.message.includes('File validation') ||
      error.message.includes('size limit')
    )) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    throw error
  }
})
