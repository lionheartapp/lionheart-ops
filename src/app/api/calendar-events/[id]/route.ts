import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import { z } from 'zod'

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  timezone: z.string().optional(),
  isAllDay: z.boolean().optional(),
  rrule: z.string().optional(),
  categoryId: z.string().optional(),
  locationText: z.string().optional(),
  buildingId: z.string().optional(),
  areaId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  editMode: z.enum(['this', 'thisAndFollowing', 'all']).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const event = await calendarService.getEventById(id)
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }
      return NextResponse.json(ok(event))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params
    const body = await req.json()
    const data = updateEventSchema.parse(body)

    const { editMode, startTime, endTime, ...rest } = data

    return await runWithOrgContext(orgId, async () => {
      // Check if user can edit all or just own
      const event = await calendarService.getEventById(id)
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }

      if (event.createdById === ctx.userId) {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_UPDATE_OWN)
      } else {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL)
      }

      const updated = await calendarService.updateEvent(
        id,
        {
          ...rest,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
        },
        editMode || 'all',
        ctx.userId
      )
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const event = await calendarService.getEventById(id)
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }

      if (event.createdById === ctx.userId) {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_DELETE_OWN)
      } else {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_DELETE_ALL)
      }

      await calendarService.deleteEvent(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
