import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'

const db = prisma as any

// ── Sports ─────────────────────────────────────────────────────────────

export async function getSports(filters?: { isActive?: boolean }) {
  return db.sport.findMany({
    where: { ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}) },
    include: {
      _count: { select: { athleticTeams: true, athleticSeasons: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function createSport(data: {
  name: string
  abbreviation?: string
  color?: string
  icon?: string
  seasonType?: string
}) {
  return db.sport.create({
    data: {
      name: data.name,
      abbreviation: data.abbreviation || null,
      color: data.color || '#6b7280',
      icon: data.icon || null,
      seasonType: data.seasonType || 'FALL',
    },
  })
}

export async function updateSport(id: string, data: {
  name?: string
  abbreviation?: string | null
  color?: string
  seasonType?: string
}) {
  return db.sport.update({
    where: { id },
    data,
    include: {
      _count: { select: { athleticTeams: true, athleticSeasons: true } },
    },
  })
}

// ── Athletic Seasons ───────────────────────────────────────────────────

export async function getAthleticSeasons(filters?: { sportId?: string }) {
  return db.athleticSeason.findMany({
    where: { ...(filters?.sportId ? { sportId: filters.sportId } : {}) },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      _count: { select: { teams: true } },
    },
    orderBy: { startDate: 'desc' },
  })
}

export async function createAthleticSeason(data: {
  sportId: string
  name: string
  startDate: Date
  endDate: Date
  isCurrent?: boolean
}) {
  if (data.isCurrent) {
    await db.athleticSeason.updateMany({
      where: { sportId: data.sportId, isCurrent: true },
      data: { isCurrent: false },
    })
  }
  return db.athleticSeason.create({
    data: {
      sportId: data.sportId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: data.isCurrent ?? false,
    },
    include: { sport: { select: { id: true, name: true, color: true } } },
  })
}

// ── Teams ──────────────────────────────────────────────────────────────

export async function getTeams(filters?: { sportId?: string; seasonId?: string }) {
  return db.athleticTeam.findMany({
    where: {
      ...(filters?.sportId ? { sportId: filters.sportId } : {}),
      ...(filters?.seasonId ? { seasonId: filters.seasonId } : {}),
    },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      season: { select: { id: true, name: true } },
      _count: { select: { games: true, practices: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getTeamById(id: string) {
  return db.athleticTeam.findUnique({
    where: { id },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      season: { select: { id: true, name: true } },
      games: { orderBy: { startTime: 'asc' } },
      practices: { orderBy: { startTime: 'asc' } },
    },
  })
}

export async function createTeam(data: {
  sportId: string
  seasonId: string
  name: string
  level?: string
  coachUserId?: string
  coachName?: string
  schoolId?: string
  calendarId?: string
}) {
  return db.athleticTeam.create({
    data: {
      sportId: data.sportId,
      seasonId: data.seasonId,
      name: data.name,
      level: data.level || 'VARSITY',
      coachUserId: data.coachUserId || null,
      coachName: data.coachName || null,
      schoolId: data.schoolId || null,
      calendarId: data.calendarId || null,
    },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      season: { select: { id: true, name: true } },
    },
  })
}

export async function updateTeam(id: string, data: {
  name?: string
  level?: string
  coachUserId?: string | null
  coachName?: string | null
  schoolId?: string | null
  calendarId?: string | null
}) {
  return db.athleticTeam.update({
    where: { id },
    data,
    include: {
      sport: { select: { id: true, name: true, color: true } },
      season: { select: { id: true, name: true } },
    },
  })
}

export async function deleteTeam(id: string) {
  return db.athleticTeam.delete({ where: { id } })
}

// ── Games ──────────────────────────────────────────────────────────────

export async function getGames(filters?: { teamId?: string; startDate?: Date; endDate?: Date }) {
  return db.game.findMany({
    where: {
      ...(filters?.teamId ? { athleticTeamId: filters.teamId } : {}),
      ...(filters?.startDate && filters?.endDate
        ? { startTime: { gte: filters.startDate, lte: filters.endDate } }
        : {}),
    },
    include: {
      athleticTeam: {
        select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } },
      },
    },
    orderBy: { startTime: 'asc' },
  })
}

export async function createGame(data: {
  athleticTeamId: string
  opponentName: string
  homeAway?: string
  startTime: Date
  endTime: Date
  venue?: string
}, autoCreateEvent?: { calendarId: string }) {
  const game = await db.game.create({
    data: {
      athleticTeamId: data.athleticTeamId,
      opponentName: data.opponentName,
      homeAway: data.homeAway || 'HOME',
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.venue || null,
    },
    include: {
      athleticTeam: {
        select: { id: true, name: true, sport: { select: { name: true, color: true } } },
      },
    },
  })

  // Auto-create linked calendar event
  if (autoCreateEvent?.calendarId) {
    const prefix = data.homeAway === 'AWAY' ? '@ ' : 'vs '
    const event = await db.calendarEvent.create({
      data: {
        calendarId: autoCreateEvent.calendarId,
        title: `${game.athleticTeam.sport.name}: ${game.athleticTeam.name} ${prefix}${data.opponentName}`,
        startTime: data.startTime,
        endTime: data.endTime,
        locationText: data.venue || null,
        calendarStatus: 'CONFIRMED',
        sourceModule: 'athletics',
        sourceId: game.id,
      },
    })
    await db.game.update({
      where: { id: game.id },
      data: { calendarEventId: event.id },
    })
  }

  return game
}

export async function updateGame(id: string, data: {
  opponentName?: string
  homeAway?: string
  startTime?: Date
  endTime?: Date
  venue?: string
}) {
  return db.game.update({
    where: { id },
    data,
    include: { athleticTeam: { select: { id: true, name: true } } },
  })
}

export async function deleteGame(id: string) {
  return db.game.delete({ where: { id } })
}

export async function updateGameScore(id: string, data: {
  homeScore: number
  awayScore: number
  isFinal?: boolean
}) {
  return db.game.update({
    where: { id },
    data: {
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      isFinal: data.isFinal ?? false,
    },
  })
}

// ── Practices ──────────────────────────────────────────────────────────

export async function getPractices(filters?: { teamId?: string }) {
  return db.practice.findMany({
    where: { ...(filters?.teamId ? { athleticTeamId: filters.teamId } : {}) },
    include: {
      athleticTeam: { select: { id: true, name: true, sport: { select: { name: true } } } },
    },
    orderBy: { startTime: 'asc' },
  })
}

export async function createPractice(data: {
  athleticTeamId: string
  startTime: Date
  endTime: Date
  location?: string
  notes?: string
  rrule?: string
}) {
  return db.practice.create({
    data: {
      athleticTeamId: data.athleticTeamId,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location || null,
      notes: data.notes || null,
      rrule: data.rrule || null,
    },
  })
}

export async function updatePractice(id: string, data: {
  startTime?: Date
  endTime?: Date
  location?: string
  notes?: string
  rrule?: string | null
}) {
  return db.practice.update({
    where: { id },
    data,
  })
}

export async function deletePractice(id: string) {
  return db.practice.delete({ where: { id } })
}

// ── Tournaments ────────────────────────────────────────────────────────

export async function getTournaments(filters?: { sportId?: string }) {
  return db.tournament.findMany({
    where: { ...(filters?.sportId ? { sportId: filters.sportId } : {}) },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      _count: { select: { brackets: true } },
    },
    orderBy: { startDate: 'desc' },
  })
}

export async function createTournament(data: {
  name: string
  sportId: string
  startDate: Date
  endDate: Date
  format?: string
  calendarId?: string
}) {
  return db.tournament.create({
    data: {
      name: data.name,
      sportId: data.sportId,
      startDate: data.startDate,
      endDate: data.endDate,
      format: data.format || 'SINGLE_ELIMINATION',
      calendarId: data.calendarId || null,
    },
    include: { sport: { select: { id: true, name: true, color: true } } },
  })
}

const bracketTeamInclude = {
  select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } },
}

export async function getTournamentById(id: string) {
  return db.tournament.findUnique({
    where: { id },
    include: {
      sport: { select: { id: true, name: true, color: true } },
      brackets: {
        include: {
          team1: bracketTeamInclude,
          team2: bracketTeamInclude,
          winner: bracketTeamInclude,
        },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  })
}

export async function updateTournament(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
}) {
  return db.tournament.update({
    where: { id },
    data,
    include: { sport: { select: { id: true, name: true, color: true } } },
  })
}

export async function deleteTournament(id: string) {
  return db.tournament.delete({ where: { id } })
}

export async function generateSingleEliminationBracket(tournamentId: string, teamIds: string[]) {
  // Delete existing brackets
  await db.tournamentBracket.deleteMany({ where: { tournamentId } })

  const n = teamIds.length
  if (n < 2) throw new Error('Need at least 2 teams')

  const totalRounds = Math.ceil(Math.log2(n))
  const totalSlots = Math.pow(2, totalRounds)
  const byes = totalSlots - n

  // Seed round 1 matches
  const round1Matches = totalSlots / 2
  const brackets: Array<{
    tournamentId: string
    round: number
    matchNumber: number
    team1Id: string | null
    team2Id: string | null
    winnerId: string | null
  }> = []

  // Place teams in round 1 — byes go to top seeds
  let teamIdx = 0
  for (let m = 1; m <= round1Matches; m++) {
    const team1Id = teamIdx < teamIds.length ? teamIds[teamIdx++] : null
    const team2Id = teamIdx < teamIds.length ? teamIds[teamIdx++] : null

    const isBye = team1Id && !team2Id
    brackets.push({
      tournamentId,
      round: 1,
      matchNumber: m,
      team1Id,
      team2Id,
      winnerId: isBye ? team1Id : null,
    })
  }

  // Create empty brackets for subsequent rounds
  for (let r = 2; r <= totalRounds; r++) {
    const matchesInRound = totalSlots / Math.pow(2, r)
    for (let m = 1; m <= matchesInRound; m++) {
      brackets.push({
        tournamentId,
        round: r,
        matchNumber: m,
        team1Id: null,
        team2Id: null,
        winnerId: null,
      })
    }
  }

  // Batch create all brackets
  await db.tournamentBracket.createMany({ data: brackets })

  // Auto-advance bye winners to round 2
  if (byes > 0 && totalRounds >= 2) {
    const created = await db.tournamentBracket.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
    })

    const round1 = created.filter((b: any) => b.round === 1)
    const round2 = created.filter((b: any) => b.round === 2)

    for (const match of round1) {
      if (match.winnerId && match.team1Id && !match.team2Id) {
        // This is a bye — advance winner to round 2
        const nextMatchNumber = Math.ceil(match.matchNumber / 2)
        const nextMatch = round2.find((b: any) => b.matchNumber === nextMatchNumber)
        if (nextMatch) {
          const slot = match.matchNumber % 2 === 1 ? 'team1Id' : 'team2Id'
          await db.tournamentBracket.update({
            where: { id: nextMatch.id },
            data: { [slot]: match.winnerId },
          })
        }
      }
    }
  }

  return db.tournamentBracket.findMany({
    where: { tournamentId },
    include: {
      team1: bracketTeamInclude,
      team2: bracketTeamInclude,
      winner: bracketTeamInclude,
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  })
}

export async function generateRoundRobinBracket(tournamentId: string, teamIds: string[]) {
  await db.tournamentBracket.deleteMany({ where: { tournamentId } })

  const n = teamIds.length
  if (n < 2) throw new Error('Need at least 2 teams')

  const brackets: Array<{
    tournamentId: string
    round: number
    matchNumber: number
    team1Id: string
    team2Id: string
    winnerId: null
  }> = []

  let matchNumber = 0
  // Each pair plays once — group by rounds using circle method
  const teams = [...teamIds]
  const totalRounds = n % 2 === 0 ? n - 1 : n
  const halfSize = Math.floor(n / 2)

  // If odd number of teams, add a dummy
  if (n % 2 !== 0) teams.push('__BYE__')
  const fixed = teams[0]
  const rotating = teams.slice(1)

  for (let round = 1; round <= totalRounds; round++) {
    const currentOrder = [fixed, ...rotating]
    for (let i = 0; i < halfSize; i++) {
      const t1 = currentOrder[i]
      const t2 = currentOrder[currentOrder.length - 1 - i]
      if (t1 === '__BYE__' || t2 === '__BYE__') continue
      matchNumber++
      brackets.push({
        tournamentId,
        round,
        matchNumber,
        team1Id: t1,
        team2Id: t2,
        winnerId: null,
      })
    }
    // Rotate: move last element to position 1
    rotating.unshift(rotating.pop()!)
  }

  await db.tournamentBracket.createMany({ data: brackets })

  return db.tournamentBracket.findMany({
    where: { tournamentId },
    include: {
      team1: bracketTeamInclude,
      team2: bracketTeamInclude,
      winner: bracketTeamInclude,
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  })
}

export async function setMatchWinner(bracketId: string, winnerId: string) {
  const bracket = await db.tournamentBracket.update({
    where: { id: bracketId },
    data: { winnerId },
    include: { tournament: { select: { format: true } } },
  })

  // Auto-advance for single elimination
  if (bracket.tournament.format === 'SINGLE_ELIMINATION') {
    const nextMatchNumber = Math.ceil(bracket.matchNumber / 2)
    const nextRound = bracket.round + 1

    const nextMatch = await db.tournamentBracket.findFirst({
      where: {
        tournamentId: bracket.tournamentId,
        round: nextRound,
        matchNumber: nextMatchNumber,
      },
    })

    if (nextMatch) {
      const slot = bracket.matchNumber % 2 === 1 ? 'team1Id' : 'team2Id'
      await db.tournamentBracket.update({
        where: { id: nextMatch.id },
        data: { [slot]: winnerId },
      })
    }
  }

  return bracket
}

export async function clearMatchResult(bracketId: string) {
  const bracket = await db.tournamentBracket.findUnique({
    where: { id: bracketId },
    include: { tournament: { select: { format: true } } },
  })
  if (!bracket) throw new Error('Bracket not found')

  // Clear winner
  await db.tournamentBracket.update({
    where: { id: bracketId },
    data: { winnerId: null },
  })

  // Remove from next round for single elimination
  if (bracket.tournament.format === 'SINGLE_ELIMINATION') {
    const nextMatchNumber = Math.ceil(bracket.matchNumber / 2)
    const nextRound = bracket.round + 1

    const nextMatch = await db.tournamentBracket.findFirst({
      where: {
        tournamentId: bracket.tournamentId,
        round: nextRound,
        matchNumber: nextMatchNumber,
      },
    })

    if (nextMatch) {
      const slot = bracket.matchNumber % 2 === 1 ? 'team1Id' : 'team2Id'
      await db.tournamentBracket.update({
        where: { id: nextMatch.id },
        data: { [slot]: null },
      })
    }
  }

  return { success: true }
}

// ── Roster ────────────────────────────────────────────────────────────────

export async function getRoster(filters?: { teamId?: string; isActive?: boolean }) {
  return db.athleticRoster.findMany({
    where: {
      ...(filters?.teamId ? { athleticTeamId: filters.teamId } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      athleticTeam: { select: { id: true, name: true, sport: { select: { name: true, color: true } } } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

export async function getRosterPlayer(id: string) {
  return db.athleticRoster.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      athleticTeam: { select: { id: true, name: true, sport: { select: { name: true, color: true } } } },
      gameStats: {
        include: { game: { select: { id: true, opponentName: true, startTime: true, isFinal: true } } },
        orderBy: { game: { startTime: 'desc' } },
      },
    },
  })
}

export async function createRosterPlayer(data: {
  athleticTeamId: string
  firstName: string
  lastName: string
  jerseyNumber?: string
  position?: string
  grade?: string
  height?: string
  weight?: string
  userId?: string
}) {
  return db.athleticRoster.create({
    data: {
      athleticTeamId: data.athleticTeamId,
      firstName: data.firstName,
      lastName: data.lastName,
      jerseyNumber: data.jerseyNumber || null,
      position: data.position || null,
      grade: data.grade || null,
      height: data.height || null,
      weight: data.weight || null,
      userId: data.userId || null,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      athleticTeam: { select: { id: true, name: true } },
    },
  })
}

export async function updateRosterPlayer(id: string, data: {
  firstName?: string
  lastName?: string
  jerseyNumber?: string | null
  position?: string | null
  grade?: string | null
  height?: string | null
  weight?: string | null
  userId?: string | null
  isActive?: boolean
}) {
  return db.athleticRoster.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      athleticTeam: { select: { id: true, name: true } },
    },
  })
}

export async function deleteRosterPlayer(id: string) {
  return db.athleticRoster.delete({ where: { id } })
}

// ── Player Game Stats ─────────────────────────────────────────────────────

export async function getPlayerGameStats(filters: { gameId?: string; rosterId?: string }) {
  return db.playerGameStat.findMany({
    where: {
      ...(filters.gameId ? { gameId: filters.gameId } : {}),
      ...(filters.rosterId ? { rosterId: filters.rosterId } : {}),
    },
    include: {
      roster: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true } },
      game: { select: { id: true, opponentName: true, startTime: true } },
    },
    orderBy: { statKey: 'asc' },
  })
}

export async function upsertPlayerGameStat(data: {
  rosterId: string
  gameId: string
  statKey: string
  statValue: number
}) {
  return db.playerGameStat.upsert({
    where: {
      rosterId_gameId_statKey: {
        rosterId: data.rosterId,
        gameId: data.gameId,
        statKey: data.statKey,
      },
    },
    create: {
      rosterId: data.rosterId,
      gameId: data.gameId,
      statKey: data.statKey,
      statValue: data.statValue,
    },
    update: {
      statValue: data.statValue,
    },
  })
}

export async function bulkUpsertPlayerGameStats(
  stats: Array<{ rosterId: string; gameId: string; statKey: string; statValue: number }>
) {
  const results = []
  for (const stat of stats) {
    results.push(await upsertPlayerGameStat(stat))
  }
  return results
}

export async function deletePlayerGameStats(gameId: string, rosterId?: string) {
  return db.playerGameStat.deleteMany({
    where: {
      gameId,
      ...(rosterId ? { rosterId } : {}),
    },
  })
}

// ── Sport Stat Configs ────────────────────────────────────────────────────

export async function getSportStatConfigs(sportId: string) {
  return db.sportStatConfig.findMany({
    where: { sportId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function upsertSportStatConfig(data: {
  sportId: string
  statKey: string
  label: string
  sortOrder?: number
}) {
  return db.sportStatConfig.upsert({
    where: {
      sportId_statKey: {
        sportId: data.sportId,
        statKey: data.statKey,
      },
    },
    create: {
      sportId: data.sportId,
      statKey: data.statKey,
      label: data.label,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
    },
    update: {
      label: data.label,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
    },
  })
}

export async function deleteSportStatConfig(id: string) {
  return db.sportStatConfig.update({
    where: { id },
    data: { isActive: false },
  })
}

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
