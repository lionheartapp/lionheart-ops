import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getEventSeries,
  updateEventSeries,
  deactivateEventSeries,
} from '@/lib/services/eventSeriesService'
import { UpdateEventSeriesSchema } from '@/lib/types/event-project'

/**
 * GET /api/events/series/[id]
 *
 * Returns a single EventSeries with all its spawned EventProjects included.
 */
export const GET = withAuth(async ({ params }) => {
  const series = await getEventSeries(params.id)

  if (!series) {
    return NextResponse.json(fail('NOT_FOUND', 'EventSeries not found'), { status: 404 })
  }

  return NextResponse.json(ok(series))
}, { permission: PERMISSIONS.EVENT_SERIES_MANAGE })

/**
 * PATCH /api/events/series/[id]
 *
 * Updates fields on an EventSeries.
 * Requires EVENT_SERIES_MANAGE permission.
 */
export const PATCH = withAuth(async ({ params, body }) => {
  const updated = await updateEventSeries(params.id, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENT_SERIES_MANAGE, schema: UpdateEventSeriesSchema })

/**
 * DELETE /api/events/series/[id]
 *
 * Deactivates an EventSeries (sets isActive=false — soft deactivation).
 * Existing spawned projects are not affected.
 * Requires EVENT_SERIES_MANAGE permission.
 */
export const DELETE = withAuth(async ({ params }) => {
  await deactivateEventSeries(params.id)
  return NextResponse.json(ok({ deactivated: true }))
}, { permission: PERMISSIONS.EVENT_SERIES_MANAGE })
