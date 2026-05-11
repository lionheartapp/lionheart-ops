import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import { z } from 'zod'

// GET — list current user's subscriptions
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDARS_READ)

    return await runWithOrgContext(orgId, async () => {
      const subs = await calendarService.getUserSubscriptions(ctx.userId)
      return NextResponse.json(ok(subs))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const toggleSchema = z.object({
  calendarId: z.string().min(1),
  notifyOnNew: z.boolean(),
})

const updateSchema = z.object({
  calendarId: z.string().min(1),
  notifyBeforeMinutes: z.number().nullable(),
})

// POST — toggle notifyOnNew for a calendar
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDARS_READ)

    const body = await req.json()
    const { calendarId, notifyOnNew } = toggleSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const sub = await calendarService.toggleNotifyOnNew(ctx.userId, calendarId, notifyOnNew)
      return NextResponse.json(ok(sub))
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

// PATCH — update notifyBeforeMinutes for a calendar subscription
export async function PATCH(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDARS_READ)

    const body = await req.json()
    const { calendarId, notifyBeforeMinutes } = updateSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const sub = await calendarService.updateSubscriptionPrefs(ctx.userId, calendarId, { notifyBeforeMinutes })
      return NextResponse.json(ok(sub))
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
