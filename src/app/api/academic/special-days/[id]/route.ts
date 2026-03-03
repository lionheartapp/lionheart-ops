import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateSpecialDay, deleteSpecialDay } from '@/lib/services/academicCalendarService'

const UpdateSpecialDaySchema = z.object({
  date: z.string().transform((s) => new Date(s)).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  specialDayType: z.enum(['HOLIDAY', 'CLOSURE', 'EARLY_DISMISSAL', 'LATE_START', 'PROFESSIONAL_DEVELOPMENT', 'TESTING', 'OTHER']).optional(),
  schoolId: z.string().nullable().optional(),
  campusId: z.string().nullable().optional(),
  isAllSchools: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_SPECIAL_DAYS)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateSpecialDaySchema.parse(body)
      const day = await updateSpecialDay(id, input)
      return NextResponse.json(ok(day))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update special day'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_SPECIAL_DAYS)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deleteSpecialDay(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete special day'), { status: 500 })
  }
}
