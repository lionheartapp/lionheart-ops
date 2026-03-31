import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import { z } from 'zod'

const createCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  calendarType: z.enum(['ACADEMIC', 'STAFF', 'TIMETABLE', 'PARENT_FACING', 'ATHLETICS', 'GENERAL', 'PERSONAL']),
  color: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'ORG_WIDE', 'CAMPUS', 'ROLE_RESTRICTED', 'PRIVATE']).optional(),
  requiresApproval: z.boolean().optional(),
  campusId: z.string().optional(),
  schoolId: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const calendars = await calendarService.getCalendars({
    calendarType: searchParams.get('calendarType') || undefined,
    campusId: searchParams.get('campusId') || undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    isActive: searchParams.get('isActive') === 'false' ? false : true,
    userId: ctx.userId,
    roleName: ctx.roleName ?? undefined,
  })
  return NextResponse.json(ok(calendars))
}, { permission: PERMISSIONS.CALENDARS_READ })

export const POST = withAuth(async ({ body }) => {
  const calendar = await calendarService.createCalendar(body)
  return NextResponse.json(ok(calendar), { status: 201 })
}, { permission: PERMISSIONS.CALENDARS_CREATE, schema: createCalendarSchema })
