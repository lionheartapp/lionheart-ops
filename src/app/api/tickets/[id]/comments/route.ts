import { NextRequest, NextResponse } from 'next/server'
import { fail, isAuthError, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as ticketService from '@/lib/services/ticketService'
import * as ticketCommentService from '@/lib/services/ticketCommentService'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/tickets/[id]/comments', method: 'GET' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      // Verify ticket access — enforces org scoping + access control
      const ticket = await ticketService.getTicketById(id, ctx.userId)
      if (!ticket) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }

      const comments = await ticketCommentService.listComments(id)
      return NextResponse.json(ok(comments))
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
    log.error({ err: error }, 'Failed to fetch ticket comments')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/tickets/[id]/comments', method: 'POST' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      // Verify ticket access before posting comment
      const ticket = await ticketService.getTicketById(id, ctx.userId)
      if (!ticket) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }

      const comment = await ticketCommentService.createComment(id, ctx.userId, body, orgId)
      return NextResponse.json(ok(comment), { status: 201 })
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
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to create ticket comment')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
