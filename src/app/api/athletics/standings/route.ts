import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeamStandings, getTeams } from '@/lib/services/athleticsService'

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Standing = Awaited<ReturnType<typeof getTeamStandings>>[number]

function visibleTeamIdsForCoach(teams: Team[], userId: string, scope: 'mine' | 'sport') {
  const assignedTeams = teams.filter((team: Team) => team.coachUserId === userId)
  const assignedTeamIds = new Set(assignedTeams.map((team: Team) => team.id))
  if (scope === 'mine') return assignedTeamIds

  const assignedSportIds = new Set(assignedTeams.map((team: Team) => team.sport.id))
  return new Set(teams.filter((team: Team) => assignedSportIds.has(team.sport.id)).map((team: Team) => team.id))
}

export const GET = withAuth(async ({ searchParams, ctx, permissions }) => {
  const sportId = searchParams.get('sportId') || undefined
  const seasonId = searchParams.get('seasonId') || undefined

  const standings = await getTeamStandings({ sportId, seasonId })
  const canViewAll = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (canViewAll) return NextResponse.json(ok(standings))

  const teams = await getTeams()
  const scope = searchParams.get('scope') === 'sport' ? 'sport' : 'mine'
  const visibleTeamIds = visibleTeamIdsForCoach(teams, ctx.userId, scope)
  return NextResponse.json(ok(standings.filter((standing: Standing) => visibleTeamIds.has(standing.teamId))))
}, { permission: PERMISSIONS.ATHLETICS_READ })
