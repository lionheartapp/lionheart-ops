/**
 * Athletics Service — Tournaments & Brackets
 *
 * Tournament CRUD, single-elimination and round-robin bracket generation,
 * match winner assignment, and bracket result clearing.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'

const db = prisma as unknown as OrgPrismaClient

const bracketTeamInclude = {
  select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } },
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
