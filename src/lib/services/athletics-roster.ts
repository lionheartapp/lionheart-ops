/**
 * Athletics Service — Roster & Stats
 *
 * Player roster CRUD, game stats management, and sport stat configuration.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'

const db = prisma as unknown as OrgPrismaClient

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
