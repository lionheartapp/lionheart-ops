import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthlete, getTeams, updateAthlete, deleteAthlete } from '@/lib/services/athleticsService'

const UpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  grade: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Athlete = NonNullable<Awaited<ReturnType<typeof getAthlete>>>
type AthleteRoster = Athlete['rosters'][number]

function athleteHasVisibleRoster(
  athlete: Athlete,
  teams: Team[],
  userId: string,
  scope: 'mine' | 'sport' = 'mine',
) {
  const assignedTeams = teams.filter((team: Team) => team.coachUserId === userId)
  const assignedTeamIds = new Set(assignedTeams.map((team: Team) => team.id))
  const assignedSportIds = new Set(assignedTeams.map((team: Team) => team.sport.id))
  const visibleTeamIds = scope === 'sport'
    ? new Set(teams.filter((team: Team) => assignedSportIds.has(team.sport.id)).map((team: Team) => team.id))
    : assignedTeamIds

  return athlete.rosters.some((roster: AthleteRoster) => visibleTeamIds.has(roster.athleticTeam.id))
}

export const GET = withAuth(async ({ params, searchParams, ctx, permissions }) => {
  const athlete = await getAthlete(params.id)
  if (!athlete) {
    return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
  }
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams) {
    const teams = await getTeams()
    const scope = searchParams.get('scope') === 'sport' ? 'sport' : 'mine'
    if (!athleteHasVisibleRoster(athlete, teams, ctx.userId, scope)) {
      return NextResponse.json(fail('FORBIDDEN', 'Coaches can only view players on visible teams'), { status: 403 })
    }
  }
  return NextResponse.json(ok(athlete))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams) {
    const [athlete, teams] = await Promise.all([getAthlete(params.id), getTeams()])
    if (!athlete) {
      return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
    }
    if (!athleteHasVisibleRoster(athlete, teams, ctx.userId)) {
      return NextResponse.json(fail('FORBIDDEN', 'Coaches can only edit players on assigned teams'), { status: 403 })
    }
  }
  const athlete = await updateAthlete(params.id, body)
  return NextResponse.json(ok(athlete))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: UpdateSchema })

export const DELETE = withAuth(async ({ params, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams) {
    const [athlete, teams] = await Promise.all([getAthlete(params.id), getTeams()])
    if (!athlete) {
      return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
    }
    if (!athleteHasVisibleRoster(athlete, teams, ctx.userId)) {
      return NextResponse.json(fail('FORBIDDEN', 'Coaches can only delete players on assigned teams'), { status: 403 })
    }
  }
  await deleteAthlete(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE })
