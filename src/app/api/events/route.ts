import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as eventService from '@/lib/services/eventService'
import { operationsEngine } from '@/lib/services/operations/engine'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { parseAVRequirementsAsync } from '@/lib/services/ai/avEquipmentParser'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)
  const status = searchParams.get('status') || undefined
  const requiresAVParam = searchParams.get('requiresAV')
  const requiresAV = requiresAVParam === 'true' ? true : requiresAVParam === 'false' ? false : undefined
  const fromDateParam = searchParams.get('fromDate')
  const toDateParam = searchParams.get('toDate')
  const fromDate = fromDateParam ? new Date(fromDateParam) : undefined
  const toDate = toDateParam ? new Date(toDateParam) : undefined

  const filters = { limit, skip, status: status as any, requiresAV, fromDate, toDate }

  const [total, events] = await Promise.all([
    eventService.countEvents(filters, ctx.userId),
    eventService.listEvents(filters, ctx.userId),
  ])

  return NextResponse.json(ok(events, paginationMeta(total, { page, limit, skip })))
})

export const POST = withAuth(async ({ req, ctx }) => {
  const body = await req.json()

  const event = await eventService.createEvent(body, ctx.userId)

  // Trigger operations automation
  await operationsEngine.onEventCreated(event)

  // Fire-and-forget AI parsing of AV requirements
  if ((event as any).requiresAV && (event as any).avRequirements) {
    void parseAVRequirementsAsync(event.id, (event as any).avRequirements)
  }

  return NextResponse.json(ok(event), { status: 201 })
})
