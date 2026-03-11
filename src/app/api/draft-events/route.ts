import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as draftEventService from '@/lib/services/draftEventService'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/draft-events', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.createDraftEvent(
        body,
        userContext.userId
      )
      return NextResponse.json(ok(draft), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to create draft event')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/draft-events', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const { page, limit, skip } = parsePagination(searchParams)
      const status = searchParams.get('status') || undefined

      const filters = { limit, skip, status: status as any }

      const [total, drafts] = await Promise.all([
        draftEventService.countDraftEvents(filters, userContext.userId),
        draftEventService.listDraftEvents(filters, userContext.userId),
      ])

      return NextResponse.json(ok(drafts, paginationMeta(total, { page, limit, skip })))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to fetch draft events')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function DELETE() {
  return NextResponse.json(fail('METHOD_NOT_ALLOWED', 'Use /api/draft-events/[id] for item-level operations'), { status: 405 })
}