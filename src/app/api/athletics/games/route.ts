import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getGames, getTeams, createGame } from '@/lib/services/athleticsService'

const CreateGameSchema = z.object({
  athleticTeamId: z.string().min(1),
  // Optional FK for in-org opponent teams (cross-school games). When absent,
  // the game is treated as having an external opponent identified by name only.
  opponentAthleticTeamId: z.string().min(1).optional(),
  opponentName: z.string().trim().min(1).max(200),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']).optional(),
  startTime: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)),
  venue: z.string().optional(),
  calendarId: z.string().optional(),
  // Facility booking fields (passed through to CalendarEvent)
  spaceId: z.string().optional(),
  buildingId: z.string().optional(),
  roomId: z.string().optional(),
  setupMinutes: z.number().int().min(0).max(120).optional(),
  teardownMinutes: z.number().int().min(0).max(120).optional(),
  exclusiveUse: z.boolean().optional(),
  description: z.string().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Game = Awaited<ReturnType<typeof getGames>>[number]

export const GET = withAuth(async ({ searchParams, ctx, permissions }) => {
  const teamId = searchParams.get('teamId') || undefined
  // Phase 1c Pass 5: schoolId → campusId on AthleticTeam. Accept either query
  // param name for back-compat; `campusId` is preferred.
  const campusId = searchParams.get('campusId') || searchParams.get('schoolId') || undefined
  // When filtering by a team, include games where that team is on either side
  // by default — otherwise cross-school games "disappear" from the opponent's
  // schedule. Callers who want legacy behavior can pass ?asOpponent=false.
  const asOpponentParam = searchParams.get('asOpponent')
  const includeGamesAsOpponent = asOpponentParam === null ? true : asOpponentParam !== 'false'

  const [games, teams] = await Promise.all([
    getGames({
      teamId,
      includeGamesAsOpponent,
      campusId,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
    }),
    getTeams(),
  ])

  const canViewAll = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (canViewAll) return NextResponse.json(ok(games))

  const assignedTeams = teams.filter((team: Team) => team.coachUserId === ctx.userId)
  const assignedTeamIds = new Set(assignedTeams.map((team: Team) => team.id))
  const assignedSportIds = new Set(assignedTeams.map((team: Team) => team.sport.id))
  const visibleTeamIds = searchParams.get('scope') === 'sport'
    ? new Set(teams.filter((team: Team) => assignedSportIds.has(team.sport.id)).map((team: Team) => team.id))
    : assignedTeamIds

  const scopedGames = games.filter((game: Game) =>
    visibleTeamIds.has(game.athleticTeamId) ||
    (game.opponentAthleticTeamId ? visibleTeamIds.has(game.opponentAthleticTeamId) : false)
  )
  return NextResponse.json(ok(scopedGames))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams) {
    const teams = await getTeams()
    const team = teams.find((item: Team) => item.id === body.athleticTeamId)
    if (!team || team.coachUserId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Coaches can only schedule games for assigned teams' } }, { status: 403 })
    }
  }
  const { calendarId, ...input } = body
  const game = await createGame(input, calendarId ? { calendarId } : undefined)
  return NextResponse.json(ok(game), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_GAMES_CREATE, schema: CreateGameSchema })
