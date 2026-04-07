import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeams, getSports, getGames, getPractices, getTeamStandings } from '@/lib/services/athleticsService'

// Inferred return types from athleticsService
type AthleticTeam = Awaited<ReturnType<typeof getTeams>>[number]
type AthleticGame = Awaited<ReturnType<typeof getGames>>[number]
type AthleticPractice = Awaited<ReturnType<typeof getPractices>>[number]
type AthleticStanding = Awaited<ReturnType<typeof getTeamStandings>>[number]

export const GET = withAuth(async ({ searchParams }) => {
  const campusId = searchParams.get('campusId') || undefined

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

  // Filter by campus — teams use schoolId which maps to campusId
  // Same pattern as TeamsSection/ScheduleSection client-side filter
  const teams = campusId
    ? allTeams.filter((t: AthleticTeam) => !t.schoolId || t.schoolId === campusId)
    : allTeams
  const campusTeamIds = new Set(teams.map((t: AthleticTeam) => t.id))

  const games = campusId
    ? allGames.filter((g: AthleticGame) => campusTeamIds.has(g.athleticTeamId))
    : allGames

  const practices = campusId
    ? allPractices.filter((p: AthleticPractice) => campusTeamIds.has(p.athleticTeamId))
    : allPractices

  const standings: AthleticStanding[] = campusId
    ? allStandings.filter((s: AthleticStanding) => campusTeamIds.has(s.teamId))
    : allStandings

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

  return NextResponse.json(ok({
    summary: {
      totalTeams: teams.length,
      totalSports: sports.length,
      activeSports: sports.filter((s) => s.isActive !== false).length,
      gamesThisWeek: gamesThisWeek.length,
      practicesThisWeek: practicesThisWeek.length,
      overallRecord: { wins: totalWins, losses: totalLosses, ties: totalTies },
    },
    upcomingGames,
    recentResults,
    standings: standings.slice(0, 8),
    weekSchedule: {
      games: gamesThisWeek,
      practices: practicesThisWeek,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    },
  }))
}, { permission: PERMISSIONS.ATHLETICS_READ })
