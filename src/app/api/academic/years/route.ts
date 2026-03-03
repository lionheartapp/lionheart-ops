import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getAcademicYears, createAcademicYear } from '@/lib/services/academicCalendarService'

const CreateYearSchema = z.object({
  name: z.string().trim().min(1).max(50),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  schoolId: z.string().optional(),
  isCurrent: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const schoolId = searchParams.get('schoolId') || undefined
      const years = await getAcademicYears({ schoolId })
      return NextResponse.json(ok(years))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch academic years'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ACADEMIC_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateYearSchema.parse(body)
      const year = await createAcademicYear(input)
      return NextResponse.json(ok(year), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'An academic year with that name already exists'), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create academic year'), { status: 500 })
  }
}
