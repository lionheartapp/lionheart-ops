import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getDayScheduleAssignments, assignDaySchedule } from '@/lib/services/academicCalendarService'

const AssignDayScheduleSchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  bellScheduleId: z.string().min(1),
  campusId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const campusId = searchParams.get('campusId') || undefined

      if (!startDate || !endDate) {
        return NextResponse.json(fail('VALIDATION_ERROR', 'startDate and endDate are required'), { status: 400 })
      }

      const assignments = await getDayScheduleAssignments({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        campusId,
      })
      return NextResponse.json(ok(assignments))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch day schedules'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_BELL_SCHEDULES)

    return await runWithOrgContext(orgId, async () => {
      const input = AssignDayScheduleSchema.parse(body)
      const assignment = await assignDaySchedule({
        ...input,
        organizationId: orgId,
      })
      return NextResponse.json(ok(assignment), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to assign day schedule'), { status: 500 })
  }
}
