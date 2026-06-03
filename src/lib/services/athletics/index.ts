/**
 * Athletics Service
 *
 * Re-exports all athletics functionality from sub-modules:
 *   - athletics-core.ts        — Sports, Seasons, Teams, Games, Practices CRUD
 *   - athletics-tournaments.ts — Tournaments, bracket generation, match results
 *   - athletics-roster.ts      — Roster CRUD, game stats, sport stat configs
 *   - athletics-analytics.ts   — Standings, leaders, calendar overlay, public data
 */

// ── Core CRUD ─────────────────────────────────────────────────────────────
export {
  getSports,
  createSport,
  updateSport,
  deleteSport,
  getAthleticSeasons,
  createAthleticSeason,
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getGames,
  createGame,
  updateGame,
  deleteGame,
  updateGameScore,
  getPractices,
  createPractice,
  updatePractice,
  deletePractice,
} from './core'

// ── Tournaments & Brackets ────────────────────────────────────────────────
export {
  getTournaments,
  createTournament,
  getTournamentById,
  updateTournament,
  deleteTournament,
  generateSingleEliminationBracket,
  generateRoundRobinBracket,
  setMatchWinner,
  clearMatchResult,
} from './tournaments'

// ── Athletes, Roster & Stats ─────────────────────────────────────────────
export {
  // Athlete CRUD
  getAthletes,
  getAthlete,
  createAthlete,
  updateAthlete,
  deleteAthlete,
  // Roster (team assignments)
  addAthleteToTeam,
  updateRosterEntry,
  removeAthleteFromTeam,
  // Backwards-compat (deprecated)
  getRoster,
  getRosterPlayer,
  // Game stats
  getPlayerGameStats,
  upsertPlayerGameStat,
  bulkUpsertPlayerGameStats,
  deletePlayerGameStats,
  // Stat configs
  getSportStatConfigs,
  upsertSportStatConfig,
  deleteSportStatConfig,
  // Bulk import
  bulkImportRosterPlayers,
} from './roster'

// ── Analytics, Calendar & Public ──────────────────────────────────────────
export {
  getTeamStandings,
  getPlayerStatLeaders,
  getAthleticsCalendarEvents,
  getPublicScheduleData,
  getPublicPlayerProfile,
} from './analytics'

export type { AthleticsCalendarEvent } from './analytics'

// ── Game Day Sessions ─────────────────────────────────────────────────────
export {
  getGameDaySession,
  upsertGameDaySession,
} from './game-day'
export type { GameDaySessionInput, GameDayStatus } from './game-day'
