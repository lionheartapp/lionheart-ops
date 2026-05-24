import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getGames, getTeams, updateGameScore } from '@/lib/services/athleticsService'

const ScoreSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  isFinal: z.boolean().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Game = Awaited<ReturnType<typeof getGames>>[number]

export const PUT = withAuth(async ({ params, body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams) {
    const [games, teams] = await Promise.all([getGames(), getTeams()])
    const game = games.find((item: Game) => item.id === params.id)
    const assignedTeamIds = new Set(teams.filter((team: Team) => team.coachUserId === ctx.userId).map((team: Team) => team.id))
    const canScore = Boolean(game && (assignedTeamIds.has(game.athleticTeamId) || (game.opponentAthleticTeamId && assignedTeamIds.has(game.opponentAthleticTeamId))))
    if (!canScore) {
      return NextResponse.json(fail('FORBIDDEN', 'Coaches can only score assigned team games'), { status: 403 })
    }
  }
  const game = await updateGameScore(params.id, body)
  return NextResponse.json(ok(game))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_SCORE, schema: ScoreSchema })
