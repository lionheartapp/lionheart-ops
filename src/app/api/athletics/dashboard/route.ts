import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getTeams, getSports, getGames, getPractices, getTeamStandings } from '@/lib/services/athleticsService'

// Inferred return types from athleticsService
type AthleticTeam = Awaited<ReturnType<typeof getTeams>>[number]
type AthleticGame = Awaited<ReturnType<typeof getGames>>[number]
type AthleticPractice = Awaited<ReturnType<typeof getPractices>>[number]
type AthleticStanding = Awaited<ReturnType<typeof getTeamStandings>>[number]

type AthleticsViewScope = 'mine' | 'sport' | 'all'

function scopeFromParam(value: string | null, canViewAll: boolean): AthleticsViewScope | null {
  if (value === 'mine' || value === 'sport') return value
  if (value === 'all' && canViewAll) return 'all'
  return null
}

export const GET = withAuth(async ({ searchParams, ctx, permissions }) => {
  const campusId = searchParams.get('campusId') || undefined
  const canViewAll = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  const requestedScope = scopeFromParam(searchParams.get('scope'), canViewAll)
  const viewScope: AthleticsViewScope = requestedScope ?? (canViewAll ? 'all' : 'mine')

  const now = new Date()

  // Calculate current week boundaries (Mon-Sun)
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const [allTeams, sports, allGames, allPractices, allStandings] = await Promise.all([
    getTeams(),
    getSports({ isActive: true }),
    getGames(),
    getPractices(),
    getTeamStandings(),
  ])

  const assignedTeams = allTeams.filter((t: AthleticTeam) => t.coachUserId === ctx.userId)
  const assignedTeamIds = new Set(assignedTeams.map((t: AthleticTeam) => t.id))
  const assignedSportIds = new Set(assignedTeams.map((t: AthleticTeam) => t.sport.id))
  const scopedTeams = canViewAll || viewScope === 'all'
    ? allTeams
    : viewScope === 'sport'
      ? allTeams.filter((t: AthleticTeam) => assignedSportIds.has(t.sport.id))
      : allTeams.filter((t: AthleticTeam) => assignedTeamIds.has(t.id))

  // Filter by campus — Phase 1c Pass 5 renamed AthleticTeam.schoolId → campusId.
  // Same client-side pattern as TeamsSection/ScheduleSection.
  const teams = campusId
    ? scopedTeams.filter((t: AthleticTeam) => !t.campusId || t.campusId === campusId)
    : scopedTeams
  const campusTeamIds = new Set(teams.map((t: AthleticTeam) => t.id))
  const campusTeamIdList = Array.from(campusTeamIds)

  const games = allGames.filter((g: AthleticGame) =>
    campusTeamIds.has(g.athleticTeamId) ||
    (g.opponentAthleticTeamId && campusTeamIds.has(g.opponentAthleticTeamId))
  )

  const practices = allPractices.filter((p: AthleticPractice) => campusTeamIds.has(p.athleticTeamId))

  const standings: AthleticStanding[] = allStandings.filter((s: AthleticStanding) => campusTeamIds.has(s.teamId))
  const visibleSportIds = new Set(teams.map((t: AthleticTeam) => t.sport.id))
  const visibleSports = sports.filter((s) => visibleSportIds.has(s.id))
  const rosterCounts = campusTeamIdList.length
    ? await prisma.athleticRoster.groupBy({
        by: ['athleticTeamId'],
        where: {
          athleticTeamId: { in: campusTeamIdList },
          isActive: true,
        },
        _count: { _all: true },
      })
    : []
  const rosterCountByTeam = new Map(rosterCounts.map((r) => [r.athleticTeamId, r._count._all]))

  // Split games into upcoming and recent
  const upcomingGames = games
    .filter((g: AthleticGame) => new Date(g.startTime) >= now)
    .slice(0, 7)

  const recentResults = games
    .filter((g: AthleticGame) => new Date(g.startTime) < now && g.isFinal)
    .reverse()
    .slice(0, 5)

  // Games & practices this week
  const gamesThisWeek = games.filter((g: AthleticGame) => {
    const t = new Date(g.startTime)
    return t >= weekStart && t <= weekEnd
  })

  const practicesThisWeek = practices.filter((p: AthleticPractice) => {
    const t = new Date(p.startTime)
    return t >= weekStart && t <= weekEnd
  })

  // Aggregate overall record from standings
  let totalWins = 0, totalLosses = 0, totalTies = 0
  for (const s of standings) {
    totalWins += s.wins
    totalLosses += s.losses
    totalTies += s.ties
  }

  const coachFocus = !canViewAll && teams.length > 0
    ? buildCoachFocus({
        teams,
        games,
        practices,
        rosterCountByTeam,
        now,
      })
    : null

  return NextResponse.json(ok({
    summary: {
      totalTeams: teams.length,
      totalSports: visibleSports.length,
      activeSports: visibleSports.filter((s) => s.isActive !== false).length,
      gamesThisWeek: gamesThisWeek.length,
      practicesThisWeek: practicesThisWeek.length,
      overallRecord: { wins: totalWins, losses: totalLosses, ties: totalTies },
    },
    upcomingGames,
    recentResults,
    standings: standings.slice(0, 8),
    coachFocus,
    viewer: {
      scope: viewScope,
      canViewAll,
      assignedTeamCount: assignedTeams.length,
      assignedSportIds: Array.from(assignedSportIds),
      primarySportName: assignedTeams[0]?.sport.name ?? null,
    },
    weekSchedule: {
      games: gamesThisWeek,
      practices: practicesThisWeek,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    },
  }))
}, { permission: PERMISSIONS.ATHLETICS_READ })

function buildCoachFocus({
  teams,
  games,
  practices,
  rosterCountByTeam,
  now,
}: {
  teams: AthleticTeam[]
  games: AthleticGame[]
  practices: AthleticPractice[]
  rosterCountByTeam: Map<string, number>
  now: Date
}) {
  const upcoming = games.filter((g) => new Date(g.startTime) >= now)
  const primaryTeam = teams.find((team) =>
    upcoming.some((game) => game.athleticTeamId === team.id || game.opponentAthleticTeamId === team.id)
  ) ?? teams[0]
  const primaryTeamId = primaryTeam.id
  const primaryTeamGames = games.filter((game) =>
    game.athleticTeamId === primaryTeamId || game.opponentAthleticTeamId === primaryTeamId
  )
  const primaryTeamPractices = practices.filter((practice) => practice.athleticTeamId === primaryTeamId)
  const upcomingPrimaryGames = primaryTeamGames.filter((game) => new Date(game.startTime) >= now)
  const nextGame = upcomingPrimaryGames.find((game) => !game.isFinal) ?? upcomingPrimaryGames[0] ?? null
  const scoreDueCount = primaryTeamGames.filter((game) => new Date(game.startTime) < now && !game.isFinal).length
  const missingVenueCount = primaryTeamGames.filter((game) => new Date(game.startTime) >= now && !game.venue?.trim()).length
  const rosterCount = rosterCountByTeam.get(primaryTeamId) ?? 0
  const sevenDayEnd = new Date(now)
  sevenDayEnd.setDate(now.getDate() + 7)
  const nextSevenDaysCount = primaryTeamGames.filter((game) => {
    const start = new Date(game.startTime)
    return start >= now && start <= sevenDayEnd
  }).length + primaryTeamPractices.filter((practice) => {
    const start = new Date(practice.startTime)
    return start >= now && start <= sevenDayEnd
  }).length

  return {
    primaryTeam: {
      id: primaryTeam.id,
      name: primaryTeam.name,
      level: primaryTeam.level,
      sport: primaryTeam.sport,
      rosterCount,
    },
    assignedTeams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      level: team.level,
      sport: team.sport,
      rosterCount: rosterCountByTeam.get(team.id) ?? 0,
    })),
    nextGame,
    scoreDueCount,
    missingVenueCount,
    nextSevenDaysCount,
    readiness: {
      rosterReady: rosterCount > 0,
      venueReady: !nextGame || Boolean(nextGame.venue?.trim()),
      scorebookReady: Boolean(nextGame),
    },
  }
}
