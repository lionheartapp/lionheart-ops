import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail, classifyServiceError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getBellScheduleById, updateBellSchedule, deleteBellSchedule } from '@/lib/services/academicCalendarService'
import { invalidateOrgCache } from '@/lib/cache/route-cache'

const PeriodSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  sortOrder: z.number().int().optional(),
})

const DAY_VALUES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

const UpdateBellScheduleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  schoolId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  daysOfWeek: z.array(z.enum(DAY_VALUES)).optional(),
  periods: z.array(PeriodSchema).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const schedule = await getBellScheduleById(id)
      if (!schedule) return NextResponse.json(fail('NOT_FOUND', 'Bell schedule not found'), { status: 404 })
      return NextResponse.json(ok(schedule))
    })
  } catch (error) {
    const classified = classifyServiceError(error, 'Failed to fetch bell schedule')
    return NextResponse.json(classified.body, { status: classified.status })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_BELL_SCHEDULES)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateBellScheduleSchema.parse(body)
      const schedule = await updateBellSchedule(id, input)
      invalidateOrgCache(orgId, 'academic:bell-schedules')
      invalidateOrgCache(orgId, 'academic:day-schedules')
      return NextResponse.json(ok(schedule))
    })
  } catch (error) {
    const classified = classifyServiceError(error, 'Failed to update bell schedule')
    return NextResponse.json(classified.body, { status: classified.status })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_BELL_SCHEDULES)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deleteBellSchedule(id)
      invalidateOrgCache(orgId, 'academic:bell-schedules')
      invalidateOrgCache(orgId, 'academic:day-schedules')
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    const classified = classifyServiceError(error, 'Failed to delete bell schedule')
    return NextResponse.json(classified.body, { status: classified.status })
  }
}
