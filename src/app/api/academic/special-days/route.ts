import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSpecialDays, createSpecialDay } from '@/lib/services/academicCalendarService'

const CreateSpecialDaySchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  name: z.string().trim().min(1).max(100),
  specialDayType: z.enum(['HOLIDAY', 'CLOSURE', 'EARLY_DISMISSAL', 'LATE_START', 'PROFESSIONAL_DEVELOPMENT', 'TESTING', 'OTHER']),
  schoolId: z.string().optional(),
  campusId: z.string().optional(),
  isAllSchools: z.boolean().optional(),
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
      const schoolId = searchParams.get('schoolId') || undefined
      const campusId = searchParams.get('campusId') || undefined

      const days = await getSpecialDays({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        schoolId,
        campusId,
      })
      return NextResponse.json(ok(days))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch special days'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_SPECIAL_DAYS)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateSpecialDaySchema.parse(body)
      const day = await createSpecialDay(input)
      return NextResponse.json(ok(day), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create special day'), { status: 500 })
  }
}
