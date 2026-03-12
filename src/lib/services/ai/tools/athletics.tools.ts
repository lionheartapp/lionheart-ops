/**
 * AI Assistant — Athletics Domain Tools
 *
 * Read-only tools for querying athletic teams, games, practices, standings, and stats.
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getTeams,
  getGames,
  getPractices,
  getTeamStandings,
  getPlayerStatLeaders,
  getRoster,
  getSports,
} from '@/lib/services/athleticsService'

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: List Athletic Teams ──────────────────────────────────────────
  list_athletic_teams: {
    definition: {
      name: 'list_athletic_teams',
      description:
        'List athletic teams with optional sport or season name filter. Returns team name, sport, level, coach, and game/practice counts.',
      parameters: {
        type: 'object',
        properties: {
          sport_name: { type: 'string', description: 'Filter by sport name (e.g. "basketball", "soccer"). Fuzzy-matched.' },
          season_name: { type: 'string', description: 'Filter by season name (e.g. "Spring 2026"). Fuzzy-matched.' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const sportNameFilter = input.sport_name ? String(input.sport_name).toLowerCase() : ''
      const seasonNameFilter = input.season_name ? String(input.season_name).toLowerCase() : ''

      // Get all teams, then filter client-side for fuzzy name matching
      let teams = await getTeams()

      if (sportNameFilter) {
        teams = teams.filter((t: any) =>
          (t.sport?.name || '').toLowerCase().includes(sportNameFilter)
        )
      }
      if (seasonNameFilter) {
        teams = teams.filter((t: any) =>
          (t.season?.name || '').toLowerCase().includes(seasonNameFilter)
        )
      }

      return JSON.stringify({
        teams: teams.map((t: any) => ({
          id: t.id,
          name: t.name,
          sport: t.sport?.name,
          sportColor: t.sport?.color,
          season: t.season?.name,
          level: t.level,
          coachName: t.coachName || undefined,
          gamesCount: t._count?.games ?? 0,
          practicesCount: t._count?.practices ?? 0,
        })),
        count: teams.length,
      })
    },
  },

  // ── GREEN: List Games ───────────────────────────────────────────────────
  list_games: {
    definition: {
      name: 'list_games',
      description:
        'List athletic games with optional date range and team name filter. Returns opponent, score (if final), home/away, venue, and date.',
      parameters: {
        type: 'object',
        properties: {
          team_name: { type: 'string', description: 'Filter by team name (fuzzy match, e.g. "varsity basketball")' },
          start_date: { type: 'string', description: 'Start of date range in YYYY-MM-DD format (optional)' },
          end_date: { type: 'string', description: 'End of date range in YYYY-MM-DD format (optional)' },
          limit: { type: 'number', description: 'Max results (default: 20, max: 50)' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const teamNameFilter = input.team_name ? String(input.team_name).toLowerCase() : ''
      const limit = Math.min((input.limit as number) || 20, 50)

      const filters: { startDate?: Date; endDate?: Date } = {}
      if (input.start_date) filters.startDate = new Date(String(input.start_date) + 'T00:00:00')
      if (input.end_date) filters.endDate = new Date(String(input.end_date) + 'T23:59:59')

      let games = await getGames(filters)

      if (teamNameFilter) {
        games = games.filter((g: any) =>
          (g.athleticTeam?.name || '').toLowerCase().includes(teamNameFilter) ||
          (g.athleticTeam?.sport?.name || '').toLowerCase().includes(teamNameFilter)
        )
      }

      return JSON.stringify({
        games: games.slice(0, limit).map((g: any) => ({
          id: g.id,
          team: g.athleticTeam?.name,
          sport: g.athleticTeam?.sport?.name,
          opponent: g.opponentName,
          homeAway: g.homeAway,
          venue: g.venue || undefined,
          startTime: g.startTime,
          endTime: g.endTime,
          isFinal: g.isFinal,
          homeScore: g.isFinal ? g.homeScore : undefined,
          awayScore: g.isFinal ? g.awayScore : undefined,
          result: g.isFinal ? formatGameResult(g) : undefined,
        })),
        count: Math.min(games.length, limit),
        totalGames: games.length,
      })
    },
  },

  // ── GREEN: List Practices ───────────────────────────────────────────────
  list_practices: {
    definition: {
      name: 'list_practices',
      description:
        'List athletic practices with optional team name filter. Returns time, location, and notes.',
      parameters: {
        type: 'object',
        properties: {
          team_name: { type: 'string', description: 'Filter by team name (fuzzy match)' },
          limit: { type: 'number', description: 'Max results (default: 20, max: 50)' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const teamNameFilter = input.team_name ? String(input.team_name).toLowerCase() : ''
      const limit = Math.min((input.limit as number) || 20, 50)

      let practices = await getPractices()

      if (teamNameFilter) {
        practices = practices.filter((p: any) =>
          (p.athleticTeam?.name || '').toLowerCase().includes(teamNameFilter) ||
          (p.athleticTeam?.sport?.name || '').toLowerCase().includes(teamNameFilter)
        )
      }

      return JSON.stringify({
        practices: practices.slice(0, limit).map((p: any) => ({
          id: p.id,
          team: p.athleticTeam?.name,
          sport: p.athleticTeam?.sport?.name,
          startTime: p.startTime,
          endTime: p.endTime,
          location: p.location || undefined,
          notes: p.notes || undefined,
          isRecurring: !!p.rrule,
        })),
        count: Math.min(practices.length, limit),
      })
    },
  },

  // ── GREEN: Get Standings ────────────────────────────────────────────────
  get_standings: {
    definition: {
      name: 'get_standings',
      description:
        'Get win/loss/tie standings for athletic teams. Can filter by sport or season name.',
      parameters: {
        type: 'object',
        properties: {
          sport_name: { type: 'string', description: 'Filter by sport name (e.g. "basketball")' },
          season_name: { type: 'string', description: 'Filter by season name (e.g. "Spring 2026")' },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const sportNameFilter = input.sport_name ? String(input.sport_name).toLowerCase() : ''
      const seasonNameFilter = input.season_name ? String(input.season_name).toLowerCase() : ''

      // Resolve sport/season IDs from names for the service filter
      let sportId: string | undefined
      let seasonId: string | undefined

      if (sportNameFilter) {
        const sports = await getSports({ isActive: true })
        const match = sports.find((s: any) => (s.name || '').toLowerCase().includes(sportNameFilter))
        if (match) sportId = match.id
      }

      let standings = await getTeamStandings({ sportId, seasonId })

      // Client-side filter for season name if no ID resolved
      if (seasonNameFilter && !seasonId) {
        standings = standings.filter((s: any) =>
          (s.season?.name || '').toLowerCase().includes(seasonNameFilter)
        )
      }

      return JSON.stringify({
        standings: standings.map((s: any) => ({
          team: s.teamName,
          level: s.level,
          sport: s.sport?.name,
          season: s.season?.name,
          wins: s.wins,
          losses: s.losses,
          ties: s.ties,
          gamesPlayed: s.gamesPlayed,
          winPct: Math.round(s.winPct * 1000) / 10 + '%',
          rosterCount: s.rosterCount,
        })),
        count: standings.length,
      })
    },
  },

  // ── GREEN: Get Stat Leaders ─────────────────────────────────────────────
  get_stat_leaders: {
    definition: {
      name: 'get_stat_leaders',
      description:
        'Get top players ranked by a specific statistic (e.g. points, goals, assists, rebounds). Returns player name, team, total, and per-game average.',
      parameters: {
        type: 'object',
        properties: {
          stat_key: { type: 'string', description: 'The stat category key (e.g. "points", "goals", "assists", "rebounds", "saves")' },
          sport_name: { type: 'string', description: 'Filter by sport name (optional)' },
          limit: { type: 'number', description: 'Max leaders to return (default: 10, max: 25)' },
        },
        required: ['stat_key'],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const statKey = String(input.stat_key || '').trim().toLowerCase()
      if (!statKey) return JSON.stringify({ error: 'stat_key is required (e.g. "points", "goals")' })

      const limit = Math.min((input.limit as number) || 10, 25)
      const sportNameFilter = input.sport_name ? String(input.sport_name).toLowerCase() : ''

      let sportId: string | undefined
      if (sportNameFilter) {
        const sports = await getSports({ isActive: true })
        const match = sports.find((s: any) => (s.name || '').toLowerCase().includes(sportNameFilter))
        if (match) sportId = match.id
      }

      const leaders = await getPlayerStatLeaders({ statKey, sportId, limit })

      return JSON.stringify({
        leaders: leaders.map((l: any) => ({
          rank: l.rank,
          player: `${l.firstName} ${l.lastName}`.trim(),
          jerseyNumber: l.jerseyNumber || undefined,
          team: l.teamName,
          sport: l.sportName,
          total: l.total,
          gamesPlayed: l.gamesPlayed,
          average: Math.round(l.average * 10) / 10,
        })),
        statKey,
        count: leaders.length,
      })
    },
  },

  // ── GREEN: Get Team Roster ──────────────────────────────────────────────
  get_team_roster: {
    definition: {
      name: 'get_team_roster',
      description:
        'Get the roster (players) for a specific athletic team by team name. Returns player names, jersey numbers, positions, and grades.',
      parameters: {
        type: 'object',
        properties: {
          team_name: { type: 'string', description: 'Team name to look up (fuzzy match, e.g. "varsity basketball")' },
        },
        required: ['team_name'],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const teamNameFilter = String(input.team_name || '').toLowerCase().trim()
      if (!teamNameFilter) return JSON.stringify({ error: 'team_name is required.' })

      // Find matching team(s)
      const allTeams = await getTeams()
      const matchedTeam = allTeams.find((t: any) =>
        (t.name || '').toLowerCase().includes(teamNameFilter) ||
        (`${t.sport?.name || ''} ${t.name || ''}`).toLowerCase().includes(teamNameFilter)
      )

      if (!matchedTeam) {
        const teamNames = allTeams.map((t: any) => t.name).slice(0, 10)
        return JSON.stringify({
          error: `No team found matching "${input.team_name}". Available teams: ${teamNames.join(', ')}`,
        })
      }

      const roster = await getRoster({ teamId: matchedTeam.id, isActive: true })

      return JSON.stringify({
        team: matchedTeam.name,
        sport: (matchedTeam as any).sport?.name,
        level: matchedTeam.level,
        players: roster.map((r: any) => ({
          id: r.id,
          name: `${r.firstName} ${r.lastName}`.trim(),
          jerseyNumber: r.jerseyNumber || undefined,
          position: r.position || undefined,
          grade: r.grade || undefined,
        })),
        playerCount: roster.length,
      })
    },
  },

  // ── GREEN: Get Athletics Dashboard ──────────────────────────────────────
  get_athletics_dashboard: {
    definition: {
      name: 'get_athletics_dashboard',
      description:
        'Get an athletics overview: total teams, upcoming games, recent results, and current standings. Use this for general athletics questions.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.ATHLETICS_READ,
    riskTier: 'GREEN',
    execute: async () => {
      const now = new Date()
      const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const weekBehind = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const [teams, upcomingGames, recentGames, standings] = await Promise.all([
        getTeams(),
        getGames({ startDate: now, endDate: weekAhead }),
        getGames({ startDate: weekBehind, endDate: now }),
        getTeamStandings(),
      ])

      // Only final games for recent results
      const recentResults = recentGames
        .filter((g: any) => g.isFinal)
        .slice(0, 5)
        .map((g: any) => ({
          team: g.athleticTeam?.name,
          opponent: g.opponentName,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          result: formatGameResult(g),
          date: g.startTime,
        }))

      return JSON.stringify({
        summary: {
          totalTeams: teams.length,
          upcomingGamesThisWeek: upcomingGames.length,
          recentResultsThisWeek: recentResults.length,
        },
        upcomingGames: upcomingGames.slice(0, 5).map((g: any) => ({
          team: g.athleticTeam?.name,
          sport: g.athleticTeam?.sport?.name,
          opponent: g.opponentName,
          homeAway: g.homeAway,
          startTime: g.startTime,
          venue: g.venue || undefined,
        })),
        recentResults,
        topStandings: standings.slice(0, 5).map((s: any) => ({
          team: s.teamName,
          sport: s.sport?.name,
          record: `${s.wins}-${s.losses}${s.ties > 0 ? `-${s.ties}` : ''}`,
          winPct: Math.round(s.winPct * 1000) / 10 + '%',
        })),
      })
    },
  },
}

// Helper: format game result as W/L/T string
function formatGameResult(game: any): string | undefined {
  if (!game.isFinal || game.homeScore == null || game.awayScore == null) return undefined
  const isHome = game.homeAway === 'HOME'
  const ourScore = isHome ? game.homeScore : game.awayScore
  const theirScore = isHome ? game.awayScore : game.homeScore
  if (ourScore > theirScore) return `W ${ourScore}-${theirScore}`
  if (ourScore < theirScore) return `L ${ourScore}-${theirScore}`
  return `T ${ourScore}-${theirScore}`
}

registerTools(tools)
