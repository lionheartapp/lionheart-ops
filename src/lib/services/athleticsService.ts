import { prisma } from '@/lib/db'

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
