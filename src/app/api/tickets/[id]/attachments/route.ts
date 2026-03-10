import { NextRequest, NextResponse } from 'next/server'
import { fail, isAuthError, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as ticketService from '@/lib/services/ticketService'
import * as ticketAttachmentService from '@/lib/services/ticketAttachmentService'
import { z } from 'zod'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      // Verify ticket access — enforces org scoping + access control
      const ticket = await ticketService.getTicketById(id, ctx.userId)
      if (!ticket) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }

      const attachments = await ticketAttachmentService.listAttachments(id)
      return NextResponse.json(ok(attachments))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    if (error instanceof Error && (error.message.includes('Insufficient permissions') || error.message.includes('Access denied'))) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      // Verify ticket access before uploading attachment
      const ticket = await ticketService.getTicketById(id, ctx.userId)
      if (!ticket) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }

      const attachment = await ticketAttachmentService.createAttachment(id, ctx.userId, body, orgId)
      return NextResponse.json(ok(attachment), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && (error.message.includes('Insufficient permissions') || error.message.includes('Access denied'))) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    // File validation errors bubble as plain Error with descriptive message → 400
    if (error instanceof Error && (
      error.message.includes('File type') ||
      error.message.includes('File validation') ||
      error.message.includes('size limit')
    )) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
