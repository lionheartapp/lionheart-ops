import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthleticSeasons, createAthleticSeason } from '@/lib/services/athleticsService'

const CreateSeasonSchema = z.object({
  sportId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  isCurrent: z.boolean().optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const sportId = searchParams.get('sportId') || undefined
  const seasons = await getAthleticSeasons({ sportId })
  return NextResponse.json(ok(seasons))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const season = await createAthleticSeason(body)
  return NextResponse.json(ok(season), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_MANAGE, schema: CreateSeasonSchema })
