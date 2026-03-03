import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import { z } from 'zod'

const addAttendeesSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
})

const removeAttendeeSchema = z.object({
  userId: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id: eventId } = await params

    const hasEditPerm = await canAny(ctx.userId, [
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_OWN,
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
    ])
    if (!hasEditPerm) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }

    const body = await req.json()
    const { userIds } = addAttendeesSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const records = await calendarService.addAttendees(eventId, userIds)
      return NextResponse.json(ok(records), { status: 201 })
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
    const { id: eventId } = await params

    const hasEditPerm = await canAny(ctx.userId, [
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_OWN,
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
    ])
    if (!hasEditPerm) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }

    const body = await req.json()
    const { userId } = removeAttendeeSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      await calendarService.removeAttendee(eventId, userId)
      return NextResponse.json(ok({ removed: true }))
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
