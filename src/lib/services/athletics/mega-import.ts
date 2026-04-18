/**
 * Athletics Mega-Import Service
 *
 * Processes a flat CSV-style array of rows into a full athletics hierarchy:
 *   Sports → Seasons → Teams → Players
 *
 * Deduplicates at every level — if a sport/season/team already exists in the
 * org or within the import batch, it reuses the existing record.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'

const db = prisma as unknown as OrgPrismaClient

// ── Types ────────────────────────────────────────────────────────────────────

export interface MegaImportRow {
  sport: string
  season: string
  team: string
  level?: string
  firstName: string
  lastName: string
  jerseyNumber?: string
  position?: string
  grade?: string
  height?: string
  weight?: string
}

export interface MegaImportResult {
  sports: { created: number; reused: number }
  seasons: { created: number; reused: number }
  teams: { created: number; reused: number }
  players: { created: number; errors: string[] }
  totalRows: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEASON_TYPE_MAP: Record<string, string> = {
  fall: 'FALL',
  autumn: 'FALL',
  winter: 'WINTER',
  spring: 'SPRING',
  'year-round': 'YEAR_ROUND',
  'year round': 'YEAR_ROUND',
  yearround: 'YEAR_ROUND',
  summer: 'SPRING', // close enough fallback
}

const LEVEL_MAP: Record<string, string> = {
  varsity: 'VARSITY',
  v: 'VARSITY',
  'varsity b': 'VARSITY_B',
  jv: 'JUNIOR_VARSITY',
  'junior varsity': 'JUNIOR_VARSITY',
  freshman: 'FRESHMAN',
  'frosh soph': 'FROSH_SOPH',
  'frosh-soph': 'FROSH_SOPH',
  'c team': 'C_TEAM',
  'c-team': 'C_TEAM',
  club: 'CLUB',
  intramural: 'INTRAMURAL',
}

function guessSeasonType(seasonName: string): string {
  const lower = seasonName.toLowerCase()
  for (const [keyword, type] of Object.entries(SEASON_TYPE_MAP)) {
    if (lower.includes(keyword)) return type
  }
  return 'FALL'
}

function normalizeLevel(raw?: string): string {
  if (!raw) return 'VARSITY'
  const lower = raw.trim().toLowerCase()
  return LEVEL_MAP[lower] || 'VARSITY'
}

/** Default season date range based on season name (academic year approximation) */
function guessSeasonDates(seasonName: string): { start: Date; end: Date } {
  const lower = seasonName.toLowerCase()
  const year = new Date().getFullYear()

  if (lower.includes('spring')) {
    return { start: new Date(year, 1, 1), end: new Date(year, 5, 30) } // Feb–Jun
  }
  if (lower.includes('winter')) {
    return { start: new Date(year, 10, 1), end: new Date(year + 1, 1, 28) } // Nov–Feb
  }
  if (lower.includes('summer')) {
    return { start: new Date(year, 5, 1), end: new Date(year, 7, 31) } // Jun–Aug
  }
  // Default: fall
  return { start: new Date(year, 7, 1), end: new Date(year, 10, 30) } // Aug–Nov
}

// ── Sport color palette for auto-assignment ──────────────────────────────────

const SPORT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#14b8a6',
  '#f59e0b', '#8b5cf6', '#10b981', '#0ea5e9', '#e11d48',
]

let colorIndex = 0
function nextColor(): string {
  const c = SPORT_COLORS[colorIndex % SPORT_COLORS.length]
  colorIndex++
  return c
}

// ── Main Import ──────────────────────────────────────────────────────────────

export async function megaImportAthletics(rows: MegaImportRow[]): Promise<MegaImportResult> {
  const result: MegaImportResult = {
    sports: { created: 0, reused: 0 },
    seasons: { created: 0, reused: 0 },
    teams: { created: 0, reused: 0 },
    players: { created: 0, errors: [] },
    totalRows: rows.length,
  }

  // ── Phase 1: Discover existing records ─────────────────────────────────

  const existingSports = await db.sport.findMany({ where: { isActive: true } })
  const existingSeasons = await db.athleticSeason.findMany({})
  const existingTeams = await db.athleticTeam.findMany({
    include: { sport: { select: { name: true } }, season: { select: { name: true } } },
  })

  // Lookup caches keyed by normalized name
  const sportMap = new Map<string, string>() // sportName → id
  for (const s of existingSports) sportMap.set(s.name.toLowerCase(), s.id)

  const seasonMap = new Map<string, string>() // `sportId|seasonName` → id
  for (const s of existingSeasons) seasonMap.set(`${s.sportId}|${s.name.toLowerCase()}`, s.id)

  const teamMap = new Map<string, string>() // `seasonId|teamName` → id
  for (const t of existingTeams) teamMap.set(`${t.seasonId}|${t.name.toLowerCase()}`, t.id)

  // Reset auto-color index
  colorIndex = existingSports.length

  // ── Phase 2: Process each row ──────────────────────────────────────────

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowLabel = `Row ${i + 1}`
    if (!row) continue

    try {
      // ── Validate required fields ─────────────────────────────────────
      const sportRaw = row.sport?.trim()
      const seasonRaw = row.season?.trim()
      const teamRaw = row.team?.trim()

      if (!sportRaw) {
        result.players.errors.push(`${rowLabel}: Sport name is required`)
        continue
      }
      if (!seasonRaw) {
        result.players.errors.push(`${rowLabel}: Season name is required`)
        continue
      }
      if (!teamRaw) {
        result.players.errors.push(`${rowLabel}: Team name is required`)
        continue
      }
      if (!row.firstName?.trim() || !row.lastName?.trim()) {
        result.players.errors.push(`${rowLabel}: First name and last name are required`)
        continue
      }

      const sportKey = sportRaw.toLowerCase()
      const seasonKey = seasonRaw.toLowerCase()
      const teamName = teamRaw
      const teamKey = teamName.toLowerCase()

      // ── Get or create sport ──────────────────────────────────────────
      let sportId: string
      const existingSportId = sportMap.get(sportKey)
      if (!existingSportId) {
        const sport = await db.sport.create({
          data: {
            name: sportRaw,
            color: nextColor(),
            seasonType: guessSeasonType(seasonRaw),
          },
        })
        sportId = sport.id as string
        sportMap.set(sportKey, sportId)
        result.sports.created++
      } else {
        sportId = existingSportId
        // Only count as reused once per unique sport
        if (!sportMap.has(`__counted__${sportKey}`)) {
          result.sports.reused++
          sportMap.set(`__counted__${sportKey}`, sportId)
        }
      }

      // ── Get or create season ─────────────────────────────────────────
      const seasonLookup = `${sportId}|${seasonKey}`
      let seasonId: string
      const existingSeasonId = seasonMap.get(seasonLookup)
      if (!existingSeasonId) {
        const dates = guessSeasonDates(seasonRaw)
        const season = await db.athleticSeason.create({
          data: {
            sportId,
            name: seasonRaw,
            startDate: dates.start,
            endDate: dates.end,
            isCurrent: true,
          },
        })
        seasonId = season.id as string
        seasonMap.set(seasonLookup, seasonId)
        result.seasons.created++
      } else {
        seasonId = existingSeasonId
        if (!seasonMap.has(`__counted__${seasonLookup}`)) {
          result.seasons.reused++
          seasonMap.set(`__counted__${seasonLookup}`, seasonId)
        }
      }

      // ── Get or create team ───────────────────────────────────────────
      const teamLookup = `${seasonId}|${teamKey}`
      let teamId: string
      const existingTeamId = teamMap.get(teamLookup)
      if (!existingTeamId) {
        const team = await db.athleticTeam.create({
          data: {
            sportId,
            seasonId,
            name: teamName,
            level: normalizeLevel(row.level),
          },
        })
        teamId = team.id as string
        teamMap.set(teamLookup, teamId)
        result.teams.created++
      } else {
        teamId = existingTeamId
        if (!teamMap.has(`__counted__${teamLookup}`)) {
          result.teams.reused++
          teamMap.set(`__counted__${teamLookup}`, teamId)
        }
      }

      // ── Create player ────────────────────────────────────────────────
      await db.athleticRoster.create({
        data: {
          athleticTeamId: teamId,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          jerseyNumber: row.jerseyNumber?.trim() || null,
          position: row.position?.trim() || null,
          grade: row.grade?.trim() || null,
          height: row.height?.trim() || null,
          weight: row.weight?.trim() || null,
        },
      })
      result.players.created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Unique constraint')) {
        result.players.errors.push(`${rowLabel} (${row.firstName} ${row.lastName}): Duplicate jersey number on this team`)
      } else {
        result.players.errors.push(`${rowLabel} (${row.firstName} ${row.lastName}): ${msg}`)
      }
    }
  }

  return result
}
