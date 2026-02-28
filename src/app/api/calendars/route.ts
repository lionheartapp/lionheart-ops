import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import { z } from 'zod'

const createCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  calendarType: z.enum(['ACADEMIC', 'STAFF', 'TIMETABLE', 'PARENT_FACING', 'ATHLETICS', 'GENERAL']),
  color: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'ORG_WIDE', 'CAMPUS', 'ROLE_RESTRICTED', 'PRIVATE']).optional(),
  requiresApproval: z.boolean().optional(),
  campusId: z.string().optional(),
  schoolId: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDARS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const calendars = await calendarService.getCalendars({
        calendarType: searchParams.get('calendarType') || undefined,
        campusId: searchParams.get('campusId') || undefined,
        schoolId: searchParams.get('schoolId') || undefined,
        isActive: searchParams.get('isActive') === 'false' ? false : true,
      })
      return NextResponse.json(ok(calendars))
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
    await assertCan(ctx.userId, PERMISSIONS.CALENDARS_CREATE)

    const body = await req.json()
    const data = createCalendarSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const calendar = await calendarService.createCalendar(data)
      return NextResponse.json(ok(calendar), { status: 201 })
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
