/**
 * Athletics scoring helpers — pure viewpoint math for W/L/T rollups.
 *
 * Game rows are stored once per match with a single owning team
 * (`athleticTeamId`) and `homeAway` from the OWNING team's viewpoint. When a
 * game is dual-school (both sides are in-org teams), the opponent is linked
 * via `opponentAthleticTeamId` and sees the same row with the home/away
 * interpretation flipped.
 *
 * Keep this module free of Prisma/DB imports so it stays cheap to unit-test
 * without mocks. All callers in `analytics.ts` pass plain rows from their
 * `include`/`select` queries.
 */

export interface ScorableGame {
  homeScore: number | null
  awayScore: number | null
  /** Perspective of the owning team ('HOME' | 'AWAY'). Anything else is
   *  tolerated at runtime and treated as 'AWAY' by the owning-is-home check. */
  homeAway: 'HOME' | 'AWAY' | string
}

export type GameOutcome = 'W' | 'L' | 'T' | null

export interface RecordTally {
  wins: number
  losses: number
  ties: number
}

/**
 * Resolve W/L/T for a single game from the viewpoint team's perspective.
 *
 * @param g       Game row (needs homeScore/awayScore/homeAway).
 * @param asOwner `true` if the viewpoint team is the owning team; `false` if
 *                it's the in-org opponent (home/away flipped).
 * @returns `'W'`, `'L'`, `'T'`, or `null` if the game has no recorded score.
 */
export function resolveOutcome(g: ScorableGame, asOwner: boolean): GameOutcome {
  if (g.homeScore == null || g.awayScore == null) return null
  if (g.homeScore === g.awayScore) return 'T'
  const owningIsHome = g.homeAway === 'HOME'
  // From the viewpoint team's side, are WE the home side?
  const isHome = asOwner ? owningIsHome : !owningIsHome
  const homeWon = g.homeScore > g.awayScore
  const weWon = (isHome && homeWon) || (!isHome && !homeWon)
  return weWon ? 'W' : 'L'
}

/**
 * Fold a list of games into wins/losses/ties from one team's viewpoint.
 * Games without recorded scores contribute nothing (they're treated as "not
 * played" even if `isFinal` happened to be true — defensive).
 */
export function tallyForTeam(games: Array<ScorableGame>, asOwner: boolean): RecordTally {
  let wins = 0
  let losses = 0
  let ties = 0
  for (const g of games) {
    const outcome = resolveOutcome(g, asOwner)
    if (outcome === 'W') wins++
    else if (outcome === 'L') losses++
    else if (outcome === 'T') ties++
  }
  return { wins, losses, ties }
}
