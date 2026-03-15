import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { listEventSeries, createEventSeries } from '@/lib/services/eventSeriesService'
import { CreateEventSeriesSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/series' })

/**
 * GET /api/events/series
 *
 * Returns all EventSeries for the current org.
 * Optional filter: isActive (true/false), campusId
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_SERIES_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const isActiveParam = searchParams.get('isActive')
      const campusId = searchParams.get('campusId') ?? undefined

      let isActive: boolean | undefined
      if (isActiveParam === 'true') isActive = true
      else if (isActiveParam === 'false') isActive = false

      const series = await listEventSeries({ isActive, campusId })
      return NextResponse.json(ok(series))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list EventSeries')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * POST /api/events/series
 *
 * Creates a new EventSeries template.
 * Requires EVENT_SERIES_MANAGE permission.
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_SERIES_MANAGE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = CreateEventSeriesSchema.parse(body)
      const series = await createEventSeries(validated, ctx.userId)
      return NextResponse.json(ok(series), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create EventSeries')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
