import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSeasons, createSeason } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

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

export const GET = withAuth(async ({ searchParams }) => {
  const seasons = await getSeasons({
    campusId: searchParams.get('campusId') || undefined,
    schoolId: searchParams.get('schoolId') || undefined,
  })
  return NextResponse.json(ok(seasons))
}, { permission: PERMISSIONS.PLANNING_VIEW })

export const POST = withAuth(async ({ body }) => {
  const season = await createSeason(body)
  return NextResponse.json(ok(season), { status: 201 })
}, { permission: PERMISSIONS.PLANNING_MANAGE, schema: CreateSeasonSchema })
