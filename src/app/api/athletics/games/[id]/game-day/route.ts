import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getGames,
  getTeams,
  getGameDaySession,
  upsertGameDaySession,
} from '@/lib/services/athleticsService'

const GameDaySessionSchema = z.object({
  status: z.enum(['NOT_STARTED', 'LIVE', 'PAUSED', 'FINAL']).optional(),
  currentPeriod: z.number().int().min(1).max(20).optional(),
  periodLabel: z.string().max(80).nullable().optional(),
  clockSecondsRemaining: z.number().int().min(0).nullable().optional(),
  lineup: z.unknown().nullable().optional(),
  gameState: z.unknown().nullable().optional(),
  playLog: z.unknown().nullable().optional(),
})

function asJson(value: unknown): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return value as Prisma.InputJsonValue
}

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Game = Awaited<ReturnType<typeof getGames>>[number]

async function coachCanAccessGame(gameId: string, userId: string) {
  const [games, teams] = await Promise.all([getGames(), getTeams()])
  const game = games.find((item: Game) => item.id === gameId)
  const assignedTeamIds = new Set(
    teams
      .filter((team: Team) => team.coachUserId === userId)
      .map((team: Team) => team.id)
  )
  return Boolean(
    game &&
    (assignedTeamIds.has(game.athleticTeamId) ||
      (game.opponentAthleticTeamId && assignedTeamIds.has(game.opponentAthleticTeamId)))
  )
}

export const GET = withAuth(async ({ params, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessGame(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only view assigned team game day sessions'), { status: 403 })
  }

  const session = await getGameDaySession(params.id)
  return NextResponse.json(ok(session))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessGame(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only update assigned team game day sessions'), { status: 403 })
  }

  const session = await upsertGameDaySession(params.id, {
    status: body.status,
    currentPeriod: body.currentPeriod,
    periodLabel: body.periodLabel,
    clockSecondsRemaining: body.clockSecondsRemaining,
    lineup: asJson(body.lineup),
    gameState: asJson(body.gameState),
    playLog: asJson(body.playLog),
    lastSavedById: ctx.userId,
  })
  return NextResponse.json(ok(session))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_SCORE, schema: GameDaySessionSchema })
