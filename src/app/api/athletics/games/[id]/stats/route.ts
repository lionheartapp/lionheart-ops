import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getGames, getTeams, getPlayerGameStats, bulkUpsertPlayerGameStats } from '@/lib/services/athleticsService'

const BulkStatsSchema = z.object({
  stats: z.array(z.object({
    athleteId: z.string().min(1),
    rosterId: z.string().min(1),
    statKey: z.string().min(1),
    statValue: z.number(),
  })),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Game = Awaited<ReturnType<typeof getGames>>[number]

async function coachCanAccessGame(gameId: string, userId: string) {
  const [games, teams] = await Promise.all([getGames(), getTeams()])
  const game = games.find((item: Game) => item.id === gameId)
  const assignedTeamIds = new Set(teams.filter((team: Team) => team.coachUserId === userId).map((team: Team) => team.id))
  return Boolean(game && (assignedTeamIds.has(game.athleticTeamId) || (game.opponentAthleticTeamId && assignedTeamIds.has(game.opponentAthleticTeamId))))
}

export const GET = withAuth(async ({ params, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessGame(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only view assigned team game stats'), { status: 403 })
  }
  const stats = await getPlayerGameStats({ gameId: params.id })
  return NextResponse.json(ok(stats))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessGame(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only update assigned team game stats'), { status: 403 })
  }
  const statsWithGameId = body.stats.map((s) => ({ ...s, gameId: params.id }))
  const results = await bulkUpsertPlayerGameStats(statsWithGameId)
  return NextResponse.json(ok(results))
}, { permission: PERMISSIONS.ATHLETICS_STATS_MANAGE, schema: BulkStatsSchema })
