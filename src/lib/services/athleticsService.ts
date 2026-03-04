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
