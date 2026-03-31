import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getGames, createGame } from '@/lib/services/athleticsService'

const CreateGameSchema = z.object({
  athleticTeamId: z.string().min(1),
  opponentName: z.string().trim().min(1).max(200),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']).optional(),
  startTime: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)),
  venue: z.string().optional(),
  calendarId: z.string().optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const games = await getGames({
    teamId: searchParams.get('teamId') || undefined,
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
  })
  return NextResponse.json(ok(games))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const { calendarId, ...input } = body
  const game = await createGame(input, calendarId ? { calendarId } : undefined)
  return NextResponse.json(ok(game), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_GAMES_CREATE, schema: CreateGameSchema })
