import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getBellScheduleById, updateBellSchedule, deleteBellSchedule } from '@/lib/services/academicCalendarService'

const PeriodSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  sortOrder: z.number().int().optional(),
})

const UpdateBellScheduleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  schoolId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
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
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch bell schedule'), { status: 500 })
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
      return NextResponse.json(ok(schedule))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update bell schedule'), { status: 500 })
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
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete bell schedule'), { status: 500 })
  }
}
