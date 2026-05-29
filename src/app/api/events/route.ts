import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as eventService from '@/lib/services/eventService'
import type { ListEventsInput } from '@/lib/services/eventService'
import { operationsEngine } from '@/lib/services/operations/engine'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { parseAVRequirementsAsync } from '@/lib/services/ai/avEquipmentParser'
import { cachePerUser } from '@/lib/cache/route-cache'
import { PERMISSIONS } from '@/lib/permissions'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)
  const status = searchParams.get('status') || undefined
  const requiresAVParam = searchParams.get('requiresAV')
  const requiresAV = requiresAVParam === 'true' ? true : requiresAVParam === 'false' ? false : undefined
  const fromDateParam = searchParams.get('fromDate')
  const toDateParam = searchParams.get('toDate')
  const fromDate = fromDateParam ? new Date(fromDateParam) : undefined
  const toDate = toDateParam ? new Date(toDateParam) : undefined

  const filters: Partial<ListEventsInput> = { limit, skip, status: status as ListEventsInput['status'], requiresAV, fromDate, toDate }

  const fromKey = fromDate ? fromDate.toISOString() : ''
  const toKey = toDate ? toDate.toISOString() : ''
  const cacheKey = `events:list:${status ?? ''}:${requiresAVParam ?? ''}:${fromKey}:${toKey}:${page}:${limit}`
  const { total, events } = await cachePerUser(
    ctx.userId,
    cacheKey,
    async () => {
      const [total, events] = await Promise.all([
        eventService.countEvents(filters, ctx.userId),
        eventService.listEvents(filters, ctx.userId),
      ])
      return { total, events }
    },
    { ttlMs: 5000 }
  )

  return NextResponse.json(ok(events, paginationMeta(total, { page, limit, skip })))
}, { permission: PERMISSIONS.EVENTS_READ })

export const POST = withAuth(async ({ req, ctx }) => {
  const body = await req.json()

  const event = await eventService.createEvent(body, ctx.userId)

  // Trigger operations automation
  await operationsEngine.onEventCreated(event)

  // Fire-and-forget AI parsing of AV requirements
  const eventRecord = event as typeof event & { requiresAV?: boolean; avRequirements?: string | null }
  if (eventRecord.requiresAV && eventRecord.avRequirements) {
    void parseAVRequirementsAsync(event.id, eventRecord.avRequirements)
  }

  return NextResponse.json(ok(event), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_CREATE })
