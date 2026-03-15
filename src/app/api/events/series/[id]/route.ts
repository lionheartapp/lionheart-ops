import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getEventSeries,
  updateEventSeries,
  deactivateEventSeries,
} from '@/lib/services/eventSeriesService'
import { UpdateEventSeriesSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/series/[id]' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/series/[id]
 *
 * Returns a single EventSeries with all its spawned EventProjects included.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_SERIES_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const series = await getEventSeries(id)

      if (!series) {
        return NextResponse.json(fail('NOT_FOUND', 'EventSeries not found'), { status: 404 })
      }

      return NextResponse.json(ok(series))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to fetch EventSeries')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/events/series/[id]
 *
 * Updates fields on an EventSeries.
 * Requires EVENT_SERIES_MANAGE permission.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_SERIES_MANAGE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = UpdateEventSeriesSchema.parse(body)
      const updated = await updateEventSeries(id, validated)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to update EventSeries')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/events/series/[id]
 *
 * Deactivates an EventSeries (sets isActive=false — soft deactivation).
 * Existing spawned projects are not affected.
 * Requires EVENT_SERIES_MANAGE permission.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_SERIES_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      await deactivateEventSeries(id)
      return NextResponse.json(ok({ deactivated: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to deactivate EventSeries')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
