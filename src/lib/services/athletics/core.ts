/**
 * Athletics Service — Core CRUD
 *
 * Sports, Seasons, Teams, Games, Practices CRUD operations.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'

const db = prisma as unknown as OrgPrismaClient

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

export async function deleteSport(id: string) {
  return db.sport.delete({ where: { id } })
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
  gradeLevel?: string | null
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
      gradeLevel: data.gradeLevel || null,
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
  gradeLevel?: string | null
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

// Shared include — both sides of a game come back so the UI can render from
// either team's perspective (our-team home/away, opponent-team rename, etc.).
const GAME_INCLUDE = {
  athleticTeam: {
    select: {
      id: true,
      name: true,
      level: true,
      schoolId: true,
      sport: { select: { name: true, color: true } },
    },
  },
  opponentAthleticTeam: {
    select: {
      id: true,
      name: true,
      level: true,
      schoolId: true,
      sport: { select: { name: true, color: true } },
    },
  },
} as const

interface GameEventTitleArgs {
  sportName: string
  teamName: string
  homeAway: string
  opponentLabel: string
}

/**
 * Build the owning-team-viewpoint calendar title for a game row.
 *
 * Kept in one place so `createGame` and `updateGame` can't drift. The title is
 * always from the owning team's perspective (`athleticTeam`); dual-school
 * opponents that want their own title read `opponentAthleticTeam` and flip
 * `homeAway` at render time.
 */
function buildGameEventTitle({
  sportName,
  teamName,
  homeAway,
  opponentLabel,
}: GameEventTitleArgs): string {
  const prefix = homeAway === 'AWAY' ? '@ ' : 'vs '
  return `${sportName}: ${teamName} ${prefix}${opponentLabel}`
}

export async function getGames(filters?: {
  teamId?: string
  /**
   * When provided, returns games where the team is on *either* side
   * (owning team OR opponent team). Useful for per-team schedule pages where
   * a cross-school game should show up even if the team is listed as
   * the opponent on the authoritative record.
   */
  includeGamesAsOpponent?: boolean
  /**
   * When provided, returns games where at least one participating team
   * belongs to this school (owning OR opponent). Skipped when undefined.
   */
  schoolId?: string
  startDate?: Date
  endDate?: Date
}) {
  const dateFilter =
    filters?.startDate && filters?.endDate
      ? { startTime: { gte: filters.startDate, lte: filters.endDate } }
      : {}

  // Build a list of AND clauses, each potentially containing ORs.
  const clauses: Record<string, unknown>[] = []

  if (filters?.teamId) {
    if (filters.includeGamesAsOpponent) {
      clauses.push({
        OR: [
          { athleticTeamId: filters.teamId },
          { opponentAthleticTeamId: filters.teamId },
        ],
      })
    } else {
      clauses.push({ athleticTeamId: filters.teamId })
    }
  }

  if (filters?.schoolId) {
    clauses.push({
      OR: [
        { athleticTeam: { schoolId: filters.schoolId } },
        { opponentAthleticTeam: { schoolId: filters.schoolId } },
      ],
    })
  }

  const where = {
    ...dateFilter,
    ...(clauses.length > 0 ? { AND: clauses } : {}),
  }

  return db.game.findMany({
    where,
    include: GAME_INCLUDE,
    orderBy: { startTime: 'asc' },
  })
}

export async function createGame(
  data: {
    athleticTeamId: string
    // For in-org (cross-school) opponents, pass the opponent team's id.
    // For external opponents, leave undefined and rely on opponentName.
    opponentAthleticTeamId?: string | null
    opponentName: string
    homeAway?: string
    startTime: Date
    endTime: Date
    venue?: string
  },
  autoCreateEvent?: { calendarId: string },
) {
  const game = await db.game.create({
    data: {
      athleticTeamId: data.athleticTeamId,
      opponentAthleticTeamId: data.opponentAthleticTeamId ?? null,
      opponentName: data.opponentName,
      homeAway: data.homeAway || 'HOME',
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.venue || null,
    },
    include: GAME_INCLUDE,
  })

  // Auto-create linked calendar event
  if (autoCreateEvent?.calendarId) {
    // Prefer the in-org opponent's team name for the calendar title when we
    // have one; fall back to the free-text opponentName (external opponent).
    const opponentLabel = game.opponentAthleticTeam?.name ?? data.opponentName
    const title = buildGameEventTitle({
      sportName: game.athleticTeam.sport.name,
      teamName: game.athleticTeam.name,
      homeAway: game.homeAway,
      opponentLabel,
    })
    const event = await db.calendarEvent.create({
      data: {
        calendarId: autoCreateEvent.calendarId,
        title,
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
  opponentAthleticTeamId?: string | null
  opponentName?: string
  homeAway?: string
  startTime?: Date
  endTime?: Date
  venue?: string
}) {
  const updated = await db.game.update({
    where: { id },
    data,
    include: GAME_INCLUDE,
  })

  // Keep the linked calendar event in sync. Title, time, and location can all
  // drift if the game row changes (new opponent, flipped home/away, rescheduled
  // kickoff, relocated venue), so regenerate from the authoritative post-update
  // state. Running this unconditionally avoids the trap of a title-affecting
  // field (like opponent team name) changing without us noticing.
  if (updated.calendarEventId) {
    const opponentLabel = updated.opponentAthleticTeam?.name ?? updated.opponentName
    const title = buildGameEventTitle({
      sportName: updated.athleticTeam.sport.name,
      teamName: updated.athleticTeam.name,
      homeAway: updated.homeAway,
      opponentLabel,
    })
    await db.calendarEvent.update({
      where: { id: updated.calendarEventId },
      data: {
        title,
        startTime: updated.startTime,
        endTime: updated.endTime,
        locationText: updated.venue ?? null,
      },
    })
  }

  return updated
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
