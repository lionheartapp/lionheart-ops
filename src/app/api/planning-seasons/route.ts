import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSeasons, createSeason } from '@/lib/services/planningSeasonService'

const CreateSeasonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  submissionOpen: z.string().transform((s) => new Date(s)),
  submissionClose: z.string().transform((s) => new Date(s)),
  finalizationDeadline: z.string().transform((s) => new Date(s)).optional(),
  budgetCap: z.number().optional(),
  campusId: z.string().optional(),
  schoolId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_VIEW)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const seasons = await getSeasons({
        campusId: searchParams.get('campusId') || undefined,
        schoolId: searchParams.get('schoolId') || undefined,
      })
      return NextResponse.json(ok(seasons))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch planning seasons'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateSeasonSchema.parse(body)
      const season = await createSeason(input)
      return NextResponse.json(ok(season), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create planning season'), { status: 500 })
  }
}
