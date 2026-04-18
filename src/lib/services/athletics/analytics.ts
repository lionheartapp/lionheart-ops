/**
 * Athletics Service — Analytics, Calendar Events & Public Data
 *
 * Team standings, stat leaders, calendar event overlay for games/practices,
 * and the public-facing schedule data endpoint.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { RRule } from 'rrule'

const db = prisma as unknown as OrgPrismaClient

// ── Analytics ─────────────────────────────────────────────────────────────

export async function getTeamStandings(filters?: { sportId?: string; seasonId?: string }) {
  const teams = await db.athleticTeam.findMany({
    where: {
      ...(filters?.sportId ? { sportId: filters.sportId } : {}),
      ...(filters?.seasonId ? { seasonId: filters.seasonId } : {}),
    },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      season: { select: { id: true, name: true } },
      games: { where: { isFinal: true } },
      _count: { select: { roster: true } },
    },
  })

  const standings = teams.map((team: any) => {
    let wins = 0, losses = 0, ties = 0
    for (const g of team.games) {
      if (g.homeScore == null || g.awayScore == null) continue
      if (g.homeScore === g.awayScore) { ties++; continue }
      const isHome = g.homeAway === 'HOME'
      const homeWon = g.homeScore > g.awayScore
      if ((isHome && homeWon) || (!isHome && !homeWon)) wins++
      else losses++
    }
    const gp = wins + losses + ties
    return {
      teamId: team.id,
      teamName: team.name,
      level: team.level,
      sport: team.sport,
      season: team.season,
      wins,
      losses,
      ties,
      gamesPlayed: gp,
      winPct: gp > 0 ? wins / gp : 0,
      rosterCount: team._count.roster,
    }
  })

  standings.sort((a: any, b: any) => b.winPct - a.winPct || b.wins - a.wins)
  return standings
}

export async function getPlayerStatLeaders(filters: {
  sportId?: string
  seasonId?: string
  statKey: string
  limit?: number
}) {
  const limit = filters.limit || 20

  // Build team filter conditions
  const teamWhere: Record<string, unknown> = {}
  if (filters.sportId) teamWhere.sportId = filters.sportId
  if (filters.seasonId) teamWhere.seasonId = filters.seasonId

  const stats = await db.playerGameStat.findMany({
    where: {
      statKey: filters.statKey,
      roster: {
        athleticTeam: Object.keys(teamWhere).length > 0 ? teamWhere : undefined,
      },
    },
    include: {
      roster: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jerseyNumber: true,
          athleticTeam: { select: { id: true, name: true, sport: { select: { name: true } } } },
        },
      },
    },
  })

  // Aggregate by player
  const playerMap = new Map<string, { roster: any; total: number; games: number }>()
  for (const stat of stats) {
    const key = stat.rosterId
    const existing = playerMap.get(key)
    if (existing) {
      existing.total += stat.statValue
      existing.games++
    } else {
      playerMap.set(key, { roster: stat.roster, total: stat.statValue, games: 1 })
    }
  }

  const leaders = Array.from(playerMap.values())
    .map((p) => ({
      ...p,
      average: p.games > 0 ? p.total / p.games : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      rosterId: p.roster.id,
      playerName: `${p.roster.firstName} ${p.roster.lastName}`,
      jerseyNumber: p.roster.jerseyNumber,
      team: p.roster.athleticTeam,
      total: p.total,
      gamesPlayed: p.games,
      average: Math.round(p.average * 100) / 100,
    }))

  return leaders
}

// ── Calendar Events (virtual overlay) ─────────────────────────────────────

export interface AthleticsCalendarEvent {
  id: string
  calendarId: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  timezone: string
  isAllDay: boolean
  calendarStatus: string
  rrule: null
  parentEventId: null
  isException: false
  locationText: string | null
  categoryId: null
  metadata: {
    athleticsType: 'game' | 'practice'
    sportId: string
    sportName: string
    sportColor: string
    teamId: string
    teamName: string
    teamLevel: string
    schoolId: string | null
    campusId: string
    opponentName?: string
    homeAway?: string
    venue?: string
    homeScore?: number | null
    awayScore?: number | null
    isFinal?: boolean
    location?: string | null
    notes?: string | null
  }
  calendar: {
    id: string
    name: string
    color: string
    calendarType: 'ATHLETICS'
    campus: { id: string; name: string } | null
  }
  category: null
  building: null
  area: null
  createdBy: null
  attendees: []
}

export async function getAthleticsCalendarEvents(
  campusIds: string[],
  start: Date,
  end: Date,
): Promise<AthleticsCalendarEvent[]> {
  if (campusIds.length === 0) return []

  // Phase 1: Parallel batch — schools, campuses, and teams have no interdependencies
  // on games/practices, but teams depend on school IDs. So we batch schools+campuses
  // first, then teams, then games+practices in parallel.

  // 1. Resolve campusId → schoolIds and build campus name map (parallel)
  const [schools, campuses] = await Promise.all([
    db.school.findMany({
      where: { campusId: { in: campusIds } },
      select: { id: true, campusId: true, name: true },
    }),
    db.campus.findMany({
      where: { id: { in: campusIds } },
      select: { id: true, name: true },
    }),
  ])

  const schoolIdToCampusId = new Map<string, string>(
    schools.map((s: { id: string; campusId: string }) => [s.id, s.campusId!])
  )
  // Also map campusId → itself so teams linked directly to a campus resolve correctly
  for (const cid of campusIds) {
    schoolIdToCampusId.set(cid, cid)
  }
  const schoolIds = schools.map((s: { id: string }) => s.id)

  const campusNameMap = new Map<string, string>(
    campuses.map((c: { id: string; name: string }) => [c.id, c.name])
  )

  // 2. Fetch teams — by schoolId OR by campusId (some teams reference campus directly)
  const teamWhereIds = [...new Set([...schoolIds, ...campusIds])]
  const teams = await db.athleticTeam.findMany({
    where: { schoolId: { in: teamWhereIds } },
    select: {
      id: true,
      name: true,
      level: true,
      schoolId: true,
      sport: { select: { id: true, name: true, color: true } },
    },
  })
  if (teams.length === 0) return []

  const teamIds = teams.map((t: any) => t.id as string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMap = new Map<string, any>(teams.map((t: any) => [t.id, t]))

  // 3. Fetch games and practices in parallel (both only depend on teamIds)
  const [games, practices] = await Promise.all([
    db.game.findMany({
      where: {
        athleticTeamId: { in: teamIds },
        startTime: { gte: start, lte: end },
      },
      orderBy: { startTime: 'asc' },
    }),
    db.practice.findMany({
      where: {
        athleticTeamId: { in: teamIds },
        OR: [
          // Non-recurring: only fetch practices within the date range
          { rrule: null, startTime: { gte: start, lte: end } },
          // Recurring: bound the fetch — only practices that started before range end
          // (rrule expansion in JS is already bounded to [start, end])
          { rrule: { not: null }, startTime: { lte: end } },
        ],
      },
    }),
  ])

  const results: AthleticsCalendarEvent[] = []

  // Transform games
  for (const game of games) {
    const team = teamMap.get(game.athleticTeamId)
    if (!team) continue
    const campusId = schoolIdToCampusId.get(team.schoolId) || campusIds[0]
    const prefix = game.homeAway === 'AWAY' ? '@ ' : 'vs '

    results.push({
      id: `ath-game-${game.id}`,
      calendarId: `athletics-${campusId}`,
      title: `${team.sport.name}: ${team.name} ${prefix}${game.opponentName}`,
      description: null,
      startTime: game.startTime.toISOString(),
      endTime: game.endTime.toISOString(),
      timezone: 'America/Chicago',
      isAllDay: false,
      calendarStatus: 'CONFIRMED',
      rrule: null,
      parentEventId: null,
      isException: false,
      locationText: game.venue || null,
      categoryId: null,
      metadata: {
        athleticsType: 'game',
        sportId: team.sport.id,
        sportName: team.sport.name,
        sportColor: team.sport.color,
        teamId: team.id,
        teamName: team.name,
        teamLevel: team.level,
        schoolId: team.schoolId,
        campusId,
        opponentName: game.opponentName,
        homeAway: game.homeAway,
        venue: game.venue,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        isFinal: game.isFinal,
      },
      calendar: {
        id: `athletics-${campusId}`,
        name: 'Athletics',
        color: team.sport.color || '#6b7280',
        calendarType: 'ATHLETICS',
        campus: { id: campusId, name: campusNameMap.get(campusId) || 'Campus' },
      },
      category: null,
      building: null,
      area: null,
      createdBy: null,
      attendees: [],
    })
  }

  // Transform practices (expand recurring)
  for (const practice of practices) {
    const team = teamMap.get(practice.athleticTeamId)
    if (!team) continue
    const campusId = schoolIdToCampusId.get(team.schoolId) || campusIds[0]
    const duration = new Date(practice.endTime).getTime() - new Date(practice.startTime).getTime()

    if (practice.rrule) {
      // Expand recurring practice instances within range
      try {
        const rule = RRule.fromString(practice.rrule)
        const instances = rule.between(start, end, true)
        for (const instanceDate of instances) {
          const instanceEnd = new Date(instanceDate.getTime() + duration)
          results.push(buildPracticeEvent(practice, team, campusId, campusNameMap, instanceDate, instanceEnd))
        }
      } catch {
        // Fallback: treat as non-recurring if rrule parse fails
        if (new Date(practice.startTime) >= start && new Date(practice.startTime) <= end) {
          results.push(buildPracticeEvent(practice, team, campusId, campusNameMap, practice.startTime, practice.endTime))
        }
      }
    } else {
      results.push(buildPracticeEvent(practice, team, campusId, campusNameMap, practice.startTime, practice.endTime))
    }
  }

  results.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  return results
}

function buildPracticeEvent(
  practice: any,
  team: any,
  campusId: string,
  campusNameMap: Map<string, string>,
  startTime: Date,
  endTime: Date,
): AthleticsCalendarEvent {
  return {
    id: `ath-practice-${practice.id}-${startTime.getTime()}`,
    calendarId: `athletics-${campusId}`,
    title: `${team.sport.name} Practice: ${team.name}`,
    description: practice.notes || null,
    startTime: startTime instanceof Date ? startTime.toISOString() : new Date(startTime).toISOString(),
    endTime: endTime instanceof Date ? endTime.toISOString() : new Date(endTime).toISOString(),
    timezone: 'America/Chicago',
    isAllDay: false,
    calendarStatus: 'CONFIRMED',
    rrule: null,
    parentEventId: null,
    isException: false,
    locationText: practice.location || null,
    categoryId: null,
    metadata: {
      athleticsType: 'practice',
      sportId: team.sport.id,
      sportName: team.sport.name,
      sportColor: team.sport.color,
      teamId: team.id,
      teamName: team.name,
      teamLevel: team.level,
      schoolId: team.schoolId,
      campusId,
      location: practice.location,
      notes: practice.notes,
    },
    calendar: {
      id: `athletics-${campusId}`,
      name: 'Athletics',
      color: team.sport.color || '#6b7280',
      calendarType: 'ATHLETICS',
      campus: { id: campusId, name: campusNameMap.get(campusId) || 'Campus' },
    },
    category: null,
    building: null,
    area: null,
    createdBy: null,
    attendees: [],
  }
}

// ── Public Data ───────────────────────────────────────────────────────────

export async function getPublicScheduleData(orgSlug: string) {
  const org = await rawPrisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      theme: true,
    },
  })
  if (!org) return null

  const now = new Date()

  const sports = await rawPrisma.sport.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, name: true, color: true, abbreviation: true },
    orderBy: { name: 'asc' },
  })

  const seasons = await rawPrisma.athleticSeason.findMany({
    where: { organizationId: org.id, isCurrent: true },
    select: { id: true, name: true, sportId: true },
  })

  const currentSeasonIds = seasons.map((s) => s.id)

  const teams = await rawPrisma.athleticTeam.findMany({
    where: { organizationId: org.id, seasonId: { in: currentSeasonIds } },
    select: {
      id: true,
      name: true,
      level: true,
      sportId: true,
      calendarId: true,
      sport: { select: { name: true, color: true } },
    },
  })

  const teamIds = teams.map((t) => t.id)

  const games = await rawPrisma.game.findMany({
    where: { organizationId: org.id, athleticTeamId: { in: teamIds } },
    select: {
      id: true,
      opponentName: true,
      homeAway: true,
      startTime: true,
      endTime: true,
      venue: true,
      homeScore: true,
      awayScore: true,
      isFinal: true,
      athleticTeamId: true,
      athleticTeam: { select: { name: true, level: true, sport: { select: { name: true, color: true } } } },
    },
    orderBy: { startTime: 'asc' },
  })

  const upcoming = games.filter((g) => new Date(g.startTime) >= now)
  const recent = games.filter((g) => new Date(g.startTime) < now && g.isFinal).reverse().slice(0, 20)

  // Build standings per sport
  const standingsBySport: Record<string, any[]> = {}
  for (const sport of sports) {
    const sportTeams = teams.filter((t) => t.sportId === sport.id)
    const sportGames = games.filter((g) => sportTeams.some((t) => t.id === g.athleticTeamId))

    const teamStandings = sportTeams.map((team) => {
      const tGames = sportGames.filter((g) => g.athleticTeamId === team.id && g.isFinal)
      let wins = 0, losses = 0, ties = 0
      for (const g of tGames) {
        if (g.homeScore == null || g.awayScore == null) continue
        if (g.homeScore === g.awayScore) { ties++; continue }
        const isHome = g.homeAway === 'HOME'
        const homeWon = g.homeScore > g.awayScore
        if ((isHome && homeWon) || (!isHome && !homeWon)) wins++
        else losses++
      }
      return { teamName: team.name, level: team.level, wins, losses, ties }
    })

    teamStandings.sort((a, b) => {
      const aGp = a.wins + a.losses + a.ties
      const bGp = b.wins + b.losses + b.ties
      const aWp = aGp > 0 ? a.wins / aGp : 0
      const bWp = bGp > 0 ? b.wins / bGp : 0
      return bWp - aWp || b.wins - a.wins
    })

    if (teamStandings.length > 0) {
      standingsBySport[sport.id] = teamStandings
    }
  }

  // Collect calendar IDs for iCal feed
  const calendarTeams = teams
    .filter((t) => t.calendarId)
    .map((t) => ({ teamId: t.id, teamName: t.name, calendarId: t.calendarId!, sportName: t.sport.name }))

  return {
    organization: org,
    sports,
    seasons,
    teams: teams.map((t) => ({ id: t.id, name: t.name, level: t.level, sportId: t.sportId, sport: t.sport })),
    upcoming,
    recent,
    standingsBySport,
    calendarTeams,
  }
}
