/**
 * Athletics Service — Athletes, Roster & Stats
 *
 * Athlete CRUD, team roster management, game stats, and sport stat configuration.
 *
 * Schema split:
 *   Athlete        — person info (firstName, lastName, grade, etc.)
 *   AthleticRoster — team assignment (athleteId + athleticTeamId + jersey/position)
 *   PlayerGameStat — has both athleteId and rosterId
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'

const db = prisma as unknown as OrgPrismaClient

// ── Shared Includes ──────────────────────────────────────────────────────

const athleteWithRosters = {
  rosters: {
    where: { isActive: true },
    include: {
      athleticTeam: {
        select: {
          id: true,
          name: true,
          level: true,
          sport: { select: { id: true, name: true, color: true } },
        },
      },
    },
  },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const

const rosterWithAthleteAndTeam = {
  athlete: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      height: true,
      weight: true,
      photoUrl: true,
      bio: true,
      userId: true,
    },
  },
  athleticTeam: {
    select: {
      id: true,
      name: true,
      level: true,
      sport: { select: { id: true, name: true, color: true } },
    },
  },
} as const

// ── Athlete CRUD ─────────────────────────────────────────────────────────

export async function getAthletes(filters?: { isActive?: boolean; grade?: string }) {
  return db.athlete.findMany({
    where: {
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.grade ? { grade: filters.grade } : {}),
    },
    include: athleteWithRosters,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

export async function getAthlete(id: string) {
  return db.athlete.findUnique({
    where: { id },
    include: {
      ...athleteWithRosters,
      gameStats: {
        include: {
          game: { select: { id: true, opponentName: true, startTime: true, isFinal: true } },
          roster: {
            select: {
              id: true,
              jerseyNumber: true,
              position: true,
              athleticTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { game: { startTime: 'desc' } },
      },
    },
  })
}

export async function createAthlete(data: {
  firstName: string
  lastName: string
  grade?: string | null
  height?: string | null
  weight?: string | null
  photoUrl?: string | null
  bio?: string | null
  userId?: string | null
}) {
  return db.athlete.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      grade: data.grade || null,
      height: data.height || null,
      weight: data.weight || null,
      photoUrl: data.photoUrl || null,
      bio: data.bio || null,
      userId: data.userId || null,
    },
    include: athleteWithRosters,
  })
}

export async function updateAthlete(
  id: string,
  data: {
    firstName?: string
    lastName?: string
    grade?: string | null
    height?: string | null
    weight?: string | null
    photoUrl?: string | null
    bio?: string | null
    userId?: string | null
    isActive?: boolean
  },
) {
  return db.athlete.update({
    where: { id },
    data,
    include: athleteWithRosters,
  })
}

export async function deleteAthlete(id: string) {
  return db.athlete.delete({ where: { id } })
}

// ── Roster (Team Assignment) CRUD ────────────────────────────────────────

export async function addAthleteToTeam(data: {
  athleteId: string
  athleticTeamId: string
  jerseyNumber?: string | null
  position?: string | null
}) {
  return db.athleticRoster.create({
    data: {
      athleteId: data.athleteId,
      athleticTeamId: data.athleticTeamId,
      jerseyNumber: data.jerseyNumber || null,
      position: data.position || null,
    },
    include: rosterWithAthleteAndTeam,
  })
}

export async function updateRosterEntry(
  id: string,
  data: {
    jerseyNumber?: string | null
    position?: string | null
    isActive?: boolean
  },
) {
  return db.athleticRoster.update({
    where: { id },
    data,
    include: rosterWithAthleteAndTeam,
  })
}

export async function removeAthleteFromTeam(id: string) {
  return db.athleticRoster.delete({ where: { id } })
}

// ── Backwards-Compatible Roster Queries ──────────────────────────────────

/**
 * @deprecated Use getAthletes() or query roster entries directly.
 * Kept for backwards compatibility — returns roster entries with athlete info.
 */
export async function getRoster(filters?: { teamId?: string; isActive?: boolean }) {
  return db.athleticRoster.findMany({
    where: {
      ...(filters?.teamId ? { athleticTeamId: filters.teamId } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    include: {
      ...rosterWithAthleteAndTeam,
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          height: true,
          weight: true,
          photoUrl: true,
          bio: true,
          userId: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
    orderBy: { athlete: { lastName: 'asc' } },
  })
}

/**
 * @deprecated Use getAthlete() for full athlete details.
 * Kept for backwards compatibility — returns a single roster entry with athlete + stats.
 */
export async function getRosterPlayer(id: string) {
  return db.athleticRoster.findUnique({
    where: { id },
    include: {
      ...rosterWithAthleteAndTeam,
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          height: true,
          weight: true,
          photoUrl: true,
          bio: true,
          userId: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      gameStats: {
        include: { game: { select: { id: true, opponentName: true, startTime: true, isFinal: true } } },
        orderBy: { game: { startTime: 'desc' } },
      },
    },
  })
}

// ── Player Game Stats ─────────────────────────────────────────────────────

export async function getPlayerGameStats(filters: {
  gameId?: string
  rosterId?: string
  athleteId?: string
}) {
  return db.playerGameStat.findMany({
    where: {
      ...(filters.gameId ? { gameId: filters.gameId } : {}),
      ...(filters.rosterId ? { rosterId: filters.rosterId } : {}),
      ...(filters.athleteId ? { athleteId: filters.athleteId } : {}),
    },
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true } },
      roster: {
        select: {
          id: true,
          jerseyNumber: true,
          position: true,
          athleticTeam: { select: { id: true, name: true } },
        },
      },
      game: { select: { id: true, opponentName: true, startTime: true } },
    },
    orderBy: { statKey: 'asc' },
  })
}

export async function upsertPlayerGameStat(data: {
  athleteId: string
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
      athleteId: data.athleteId,
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
  stats: Array<{ athleteId: string; rosterId: string; gameId: string; statKey: string; statValue: number }>,
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

// ── Bulk Import ──────────────────────────────────────────────────────────────

export interface BulkPlayerRow {
  firstName: string
  lastName: string
  jerseyNumber?: string
  position?: string
  grade?: string
  height?: string
  weight?: string
}

export async function bulkImportRosterPlayers(
  athleticTeamId: string,
  players: BulkPlayerRow[],
): Promise<{ created: number; errors: string[] }> {
  let created = 0
  const errors: string[] = []

  for (let i = 0; i < players.length; i++) {
    const row = players[i]
    const rowLabel = `Row ${i + 1} (${row.firstName} ${row.lastName})`
    try {
      if (!row.firstName?.trim() || !row.lastName?.trim()) {
        errors.push(`${rowLabel}: First name and last name are required`)
        continue
      }

      // Step 1: Create the Athlete record (person info)
      const athlete = await db.athlete.create({
        data: {
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          grade: row.grade?.trim() || null,
          height: row.height?.trim() || null,
          weight: row.weight?.trim() || null,
        },
      })

      // Step 2: Create the AthleticRoster entry (team assignment)
      await db.athleticRoster.create({
        data: {
          athleteId: athlete.id,
          athleticTeamId,
          jerseyNumber: row.jerseyNumber?.trim() || null,
          position: row.position?.trim() || null,
        },
      })

      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Unique constraint')) {
        errors.push(`${rowLabel}: A player with that jersey number already exists on this team`)
      } else {
        errors.push(`${rowLabel}: ${msg}`)
      }
    }
  }

  return { created, errors }
}
