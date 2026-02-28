import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import { z } from 'zod'

const createEventSchema = z.object({
  calendarId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().optional(),
  isAllDay: z.boolean().optional(),
  rrule: z.string().optional(),
  categoryId: z.string().optional(),
  locationText: z.string().optional(),
  buildingId: z.string().optional(),
  areaId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const calendarIds = searchParams.get('calendarIds')?.split(',') || []
      const start = searchParams.get('start')
      const end = searchParams.get('end')

      if (!start || !end) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'start and end query parameters are required'),
          { status: 400 }
        )
      }

      if (calendarIds.length === 0) {
        // If no calendar IDs provided, get all active calendars for the user
        const calendars = await calendarService.getCalendars({ isActive: true })
        calendarIds.push(...calendars.map((c) => c.id))
      }

      const events = await calendarService.getEventsInRange(
        calendarIds,
        new Date(start),
        new Date(end),
        {
          categoryId: searchParams.get('categoryId') || undefined,
          calendarStatus: searchParams.get('status')?.split(',') as any || undefined,
          createdById: searchParams.get('createdById') || undefined,
        }
      )

      return NextResponse.json(ok(events))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_CREATE)

    const body = await req.json()
    const data = createEventSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const canPublish = await can(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_PUBLISH)

      const event = await calendarService.createEvent(
        {
          ...data,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
        },
        ctx.userId,
        canPublish
      )

      return NextResponse.json(ok(event), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[calendar-events POST] Validation error:', error.issues)
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[calendar-events POST] Internal error:', error)
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json(fail('INTERNAL_ERROR', message), { status: 500 })
  }
}
