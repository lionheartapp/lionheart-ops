import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getBellSchedules, createBellSchedule } from '@/lib/services/academicCalendarService'

const PeriodSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  sortOrder: z.number().int().optional(),
})

const CreateBellScheduleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  schoolId: z.string().optional(),
  isDefault: z.boolean().optional(),
  periods: z.array(PeriodSchema).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const schoolId = searchParams.get('schoolId') || undefined
      const schedules = await getBellSchedules({ schoolId })
      return NextResponse.json(ok(schedules))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch bell schedules'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_BELL_SCHEDULES)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateBellScheduleSchema.parse(body)
      const schedule = await createBellSchedule(input)
      return NextResponse.json(ok(schedule), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'A bell schedule with that name already exists'), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create bell schedule'), { status: 500 })
  }
}
