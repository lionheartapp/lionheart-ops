import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'

export const GET = withAuth(async ({ params }) => {
  const calendar = await calendarService.getCalendarById(params.id)
  if (!calendar) {
    return NextResponse.json(fail('NOT_FOUND', 'Calendar not found'), { status: 404 })
  }
  return NextResponse.json(ok(calendar))
}, { permission: PERMISSIONS.CALENDARS_READ })

export const PUT = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const calendar = await calendarService.updateCalendar(params.id, body)
  return NextResponse.json(ok(calendar))
}, { permission: PERMISSIONS.CALENDARS_UPDATE })

export const DELETE = withAuth(async ({ params }) => {
  await calendarService.deleteCalendar(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.CALENDARS_DELETE })
