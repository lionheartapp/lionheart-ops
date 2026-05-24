import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getGames, getTeams, updateGame, deleteGame } from '@/lib/services/athleticsService'

const UpdateGameSchema = z.object({
  // `null` explicitly clears the FK (switches an in-org opponent back to an
  // external one). `undefined` leaves it untouched.
  opponentAthleticTeamId: z.string().min(1).nullable().optional(),
  opponentName: z.string().trim().min(1).max(200).optional(),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']).optional(),
  startTime: z.string().transform((s) => new Date(s)).optional(),
  endTime: z.string().transform((s) => new Date(s)).optional(),
  venue: z.string().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Game = Awaited<ReturnType<typeof getGames>>[number]

async function coachCanAccessGame(gameId: string, userId: string) {
  const [games, teams] = await Promise.all([getGames(), getTeams()])
  const game = games.find((item: Game) => item.id === gameId)
  const assignedTeamIds = new Set(teams.filter((team: Team) => team.coachUserId === userId).map((team: Team) => team.id))
  return Boolean(game && (assignedTeamIds.has(game.athleticTeamId) || (game.opponentAthleticTeamId && assignedTeamIds.has(game.opponentAthleticTeamId))))
}

export const PUT = withAuth(async ({ params, body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessGame(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only update assigned team games'), { status: 403 })
  }
  const game = await updateGame(params.id, body)
  return NextResponse.json(ok(game))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_CREATE, schema: UpdateGameSchema })

export const DELETE = withAuth(async ({ params, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessGame(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only delete assigned team games'), { status: 403 })
  }
  await deleteGame(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_CREATE })
