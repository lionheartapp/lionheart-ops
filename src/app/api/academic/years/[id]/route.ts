import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, classifyServiceError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateAcademicYear, deleteAcademicYear } from '@/lib/services/academicCalendarService'

const UpdateYearSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  schoolId: z.string().nullable().optional(),
  isCurrent: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateYearSchema.parse(body)
      const year = await updateAcademicYear(id, input)
      return NextResponse.json(ok(year))
    })
  } catch (error) {
    const classified = classifyServiceError(error, 'Failed to update academic year')
    return NextResponse.json(classified.body, { status: classified.status })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deleteAcademicYear(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    const classified = classifyServiceError(error, 'Failed to delete academic year')
    return NextResponse.json(classified.body, { status: classified.status })
  }
}
