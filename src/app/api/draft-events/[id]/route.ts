import { NextRequest, NextResponse } from 'next/server'
import { fail, isAuthError, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as draftEventService from '@/lib/services/draftEventService'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/draft-events/[id]', method: 'GET' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.getDraftEventById(id, ctx.userId)

      if (!draft) {
        return NextResponse.json(fail('NOT_FOUND', 'Draft event not found'), { status: 404 })
      }

      return NextResponse.json(ok(draft))
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
    log.error({ err: error }, 'Failed to fetch draft event')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/draft-events/[id]', method: 'PUT' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.updateDraftEvent(id, body, ctx.userId)
      return NextResponse.json(ok(draft))
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
    log.error({ err: error }, 'Failed to update draft event')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/draft-events/[id]', method: 'DELETE' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      await draftEventService.deleteDraftEvent(id, ctx.userId)
      return NextResponse.json(ok({ deleted: true }))
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
    log.error({ err: error }, 'Failed to delete draft event')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
