/**
 * Athletics Service — Analytics, Calendar Events & Public Data
 *
 * Team standings, stat leaders, calendar event overlay for games/practices,
 * and the public-facing schedule data endpoint.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { RRule } from 'rrule'
import { tallyForTeam, type ScorableGame } from './scoring'

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
      // Owning-team side.
      games: { where: { isFinal: true } },
      // In-org opponent side — dual-school games where this team was named as
      // `opponentAthleticTeamId`. Same row, flipped perspective.
      opponentGames: { where: { isFinal: true } },
      _count: { select: { roster: true } },
    },
  })

  const standings = teams.map((team: any) => {
    const ownerTally = tallyForTeam(team.games as ScorableGame[], true)
    const opponentTally = tallyForTeam(team.opponentGames as ScorableGame[], false)

    const wins = ownerTally.wins + opponentTally.wins
    const losses = ownerTally.losses + opponentTally.losses
    const ties = ownerTally.ties + opponentTally.ties
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
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      roster: {
        select: {
          id: true,
          jerseyNumber: true,
          athleticTeam: { select: { id: true, name: true, sport: { select: { name: true } } } },
        },
      },
    },
  })

  // Aggregate by athlete (across all roster entries)
  const playerMap = new Map<string, { athlete: any; roster: any; total: number; games: number }>()
  for (const stat of stats) {
    const key = stat.athleteId
    const existing = playerMap.get(key)
    if (existing) {
      existing.total += stat.statValue
      existing.games++
    } else {
      playerMap.set(key, { athlete: stat.athlete, roster: stat.roster, total: stat.statValue, games: 1 })
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
      athleteId: p.athlete.id,
      rosterId: p.roster.id,
      playerName: `${p.athlete.firstName} ${p.athlete.lastName}`,
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
  space: null
  /** @deprecated Phase 1b — use space */
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

  // Phase 1c Pass 5: AthleticTeam now references Campus directly via campusId
  // (the old schoolId FK was renamed). No need to resolve School→Campus anymore.

  // 1. Build campus name map for output
  const campuses = await db.campus.findMany({
    where: { id: { in: campusIds } },
    select: { id: true, name: true },
  })
  const campusNameMap = new Map<string, string>(
    campuses.map((c: { id: string; name: string }) => [c.id, c.name])
  )

  // 2. Fetch teams belonging to any of the requested campuses
  const teams = await db.athleticTeam.findMany({
    where: { campusId: { in: campusIds } },
    select: {
      id: true,
      name: true,
      level: true,
      campusId: true,
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
    const campusId = team.campusId || campusIds[0]
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
        schoolId: null,
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
      space: null,
      area: null,
      createdBy: null,
      attendees: [],
    })
  }

  // Transform practices (expand recurring)
  for (const practice of practices) {
    const team = teamMap.get(practice.athleticTeamId)
    if (!team) continue
    const campusId = team.campusId || campusIds[0]
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
      schoolId: null,
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
    space: null,
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

  // Fetch any game where either side is one of our seasonal teams — this
  // captures dual-school games where the in-org opponent is also a current
  // team. The per-team standings logic below filters each viewpoint cleanly.
  const games = await rawPrisma.game.findMany({
    where: {
      organizationId: org.id,
      OR: [
        { athleticTeamId: { in: teamIds } },
        { opponentAthleticTeamId: { in: teamIds } },
      ],
    },
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
      opponentAthleticTeamId: true,
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
    const sportTeamIds = new Set(sportTeams.map((t) => t.id))
    // Any final game touching one of this sport's teams on either side.
    const sportGames = games.filter(
      (g) =>
        g.isFinal &&
        (sportTeamIds.has(g.athleticTeamId) ||
          (g.opponentAthleticTeamId != null && sportTeamIds.has(g.opponentAthleticTeamId))),
    )

    const teamStandings = sportTeams.map((team) => {
      const asOwner = sportGames.filter((g) => g.athleticTeamId === team.id)
      const asOpponent = sportGames.filter((g) => g.opponentAthleticTeamId === team.id)
      const ownerTally = tallyForTeam(asOwner as ScorableGame[], true)
      const opponentTally = tallyForTeam(asOpponent as ScorableGame[], false)
      return {
        teamName: team.name,
        level: team.level,
        wins: ownerTally.wins + opponentTally.wins,
        losses: ownerTally.losses + opponentTally.losses,
        ties: ownerTally.ties + opponentTally.ties,
      }
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

// ── Public Player Profile ────────────────────────────────────────────────

export async function getPublicPlayerProfile(playerId: string) {
  const athlete = await rawPrisma.athlete.findUnique({
    where: { id: playerId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      rosters: {
        where: { isActive: true },
        include: {
          athleticTeam: {
            select: {
              id: true,
              name: true,
              level: true,
              sport: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  abbreviation: true,
                  statConfigs: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    select: { statKey: true, label: true },
                  },
                },
              },
            },
          },
        },
      },
      gameStats: {
        include: {
          roster: {
            select: {
              id: true,
              jerseyNumber: true,
              position: true,
              athleticTeam: { select: { id: true, name: true } },
            },
          },
          game: {
            select: {
              id: true,
              opponentName: true,
              startTime: true,
              homeAway: true,
              homeScore: true,
              awayScore: true,
              isFinal: true,
              venue: true,
            },
          },
        },
        orderBy: { game: { startTime: 'desc' } },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
    },
  })

  if (!athlete || !athlete.isActive) return null

  return athlete
}
