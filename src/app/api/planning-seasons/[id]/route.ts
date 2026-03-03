import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSeasonById, updateSeason, deleteSeason } from '@/lib/services/planningSeasonService'

const UpdateSeasonSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  submissionOpen: z.string().transform((s) => new Date(s)).optional(),
  submissionClose: z.string().transform((s) => new Date(s)).optional(),
  finalizationDeadline: z.string().transform((s) => new Date(s)).nullable().optional(),
  budgetCap: z.number().nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_VIEW)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const season = await getSeasonById(id)
      if (!season) return NextResponse.json(fail('NOT_FOUND', 'Planning season not found'), { status: 404 })
      return NextResponse.json(ok(season))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch planning season'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateSeasonSchema.parse(body)
      const season = await updateSeason(id, input)
      return NextResponse.json(ok(season))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update planning season'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deleteSeason(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete planning season'), { status: 500 })
  }
}
