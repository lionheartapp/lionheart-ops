import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTournaments, createTournament } from '@/lib/services/athleticsService'

const CreateTournamentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sportId: z.string().min(1),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'POOL_PLAY']).optional(),
  calendarId: z.string().optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const tournaments = await getTournaments({ sportId: searchParams.get('sportId') || undefined })
  return NextResponse.json(ok(tournaments))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const tournament = await createTournament(body)
  return NextResponse.json(ok(tournament), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE, schema: CreateTournamentSchema })
