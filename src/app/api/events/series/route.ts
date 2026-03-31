import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listEventSeries, createEventSeries } from '@/lib/services/eventSeriesService'
import { CreateEventSeriesSchema } from '@/lib/types/event-project'

export const GET = withAuth(async ({ searchParams }) => {
  const isActiveParam = searchParams.get('isActive')
  const campusId = searchParams.get('campusId') ?? undefined

  let isActive: boolean | undefined
  if (isActiveParam === 'true') isActive = true
  else if (isActiveParam === 'false') isActive = false

  const series = await listEventSeries({ isActive, campusId })
  return NextResponse.json(ok(series))
}, { permission: PERMISSIONS.EVENT_SERIES_MANAGE })

export const POST = withAuth(async ({ ctx, body }) => {
  const series = await createEventSeries(body, ctx.userId)
  return NextResponse.json(ok(series), { status: 201 })
}, { permission: PERMISSIONS.EVENT_SERIES_MANAGE, schema: CreateEventSeriesSchema })
