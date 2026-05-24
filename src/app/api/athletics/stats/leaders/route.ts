import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPlayerStatLeaders, getTeams } from '@/lib/services/athleticsService'

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Leader = Awaited<ReturnType<typeof getPlayerStatLeaders>>[number]

function visibleTeamIdsForCoach(teams: Team[], userId: string, scope: 'mine' | 'sport') {
  const assignedTeams = teams.filter((team: Team) => team.coachUserId === userId)
  const assignedTeamIds = new Set(assignedTeams.map((team: Team) => team.id))
  if (scope === 'mine') return assignedTeamIds

  const assignedSportIds = new Set(assignedTeams.map((team: Team) => team.sport.id))
  return new Set(teams.filter((team: Team) => assignedSportIds.has(team.sport.id)).map((team: Team) => team.id))
}

export const GET = withAuth(async ({ searchParams, ctx, permissions }) => {
  const statKey = searchParams.get('statKey')
  if (!statKey) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'statKey is required'), { status: 400 })
  }

  const sportId = searchParams.get('sportId') || undefined
  const seasonId = searchParams.get('seasonId') || undefined
  const limit = searchParams.get('limit')

  const leaders = await getPlayerStatLeaders({
    statKey,
    sportId,
    seasonId,
    limit: limit ? parseInt(limit, 10) : undefined,
  })
  const canViewAll = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (canViewAll) return NextResponse.json(ok(leaders))

  const teams = await getTeams()
  const scope = searchParams.get('scope') === 'sport' ? 'sport' : 'mine'
  const visibleTeamIds = visibleTeamIdsForCoach(teams, ctx.userId, scope)
  return NextResponse.json(ok(leaders.filter((leader: Leader) => visibleTeamIds.has(leader.team.id))))
}, { permission: PERMISSIONS.ATHLETICS_READ })
