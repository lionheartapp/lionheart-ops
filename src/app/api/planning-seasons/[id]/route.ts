import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSeasonById, updateSeason, deleteSeason } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const UpdateSeasonSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  submissionOpen: z.string().transform((s) => new Date(s)).optional(),
  submissionClose: z.string().transform((s) => new Date(s)).optional(),
  finalizationDeadline: z.string().transform((s) => new Date(s)).nullable().optional(),
  budgetCap: z.number().nullable().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const season = await getSeasonById(params.id)
  if (!season) return NextResponse.json(fail('NOT_FOUND', 'Planning season not found'), { status: 404 })
  return NextResponse.json(ok(season))
}, { permission: PERMISSIONS.PLANNING_VIEW })

export const PUT = withAuth(async ({ params, body }) => {
  const season = await updateSeason(params.id, body)
  return NextResponse.json(ok(season))
}, { permission: PERMISSIONS.PLANNING_MANAGE, schema: UpdateSeasonSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteSeason(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.PLANNING_MANAGE })
