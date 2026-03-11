import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as eventService from '@/lib/services/eventService'
import { operationsEngine } from '@/lib/services/operations/engine'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/events', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const { page, limit, skip } = parsePagination(searchParams)
      const status = searchParams.get('status') || undefined

      const filters = { limit, skip, status: status as any }

      const [total, events] = await Promise.all([
        eventService.countEvents(filters, userContext.userId),
        eventService.listEvents(filters, userContext.userId),
      ])

      return NextResponse.json(ok(events, paginationMeta(total, { page, limit, skip })))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to fetch events')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/events', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const event = await eventService.createEvent(
        body,
        userContext.userId
      )

      // Trigger operations automation
      await operationsEngine.onEventCreated(event)

      return NextResponse.json(ok(event), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && (error as any).code === 'ROOM_CONFLICT') {
      return NextResponse.json(fail('ROOM_CONFLICT', error.message), { status: 409 })
    }
    if (error instanceof Error && error.message.includes('permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create event')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
