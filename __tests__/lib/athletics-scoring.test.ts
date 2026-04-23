import { describe, it, expect } from 'vitest'
import {
  resolveOutcome,
  tallyForTeam,
  type ScorableGame,
} from '@/lib/services/athletics/scoring'

/**
 * Viewpoint invariants for the scoring helpers in
 * `src/lib/services/athletics/scoring.ts`.
 *
 * The Game row stores `homeAway` from the owning team's perspective, and
 * `homeScore` / `awayScore` are the literal home-side / away-side scores.
 * A dual-school game is a single row with both sides filled in — each team
 * reads that row through its own relation (owning vs opponent).
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function game(partial: Partial<ScorableGame>): ScorableGame {
  return {
    homeScore: 0,
    awayScore: 0,
    homeAway: 'HOME',
    ...partial,
  }
}

// ── resolveOutcome ─────────────────────────────────────────────────────────

describe('resolveOutcome — owning team viewpoint', () => {
  it('owning team HOME + home wins → W', () => {
    expect(resolveOutcome(game({ homeAway: 'HOME', homeScore: 3, awayScore: 1 }), true))
      .toBe('W')
  })

  it('owning team HOME + home loses → L', () => {
    expect(resolveOutcome(game({ homeAway: 'HOME', homeScore: 1, awayScore: 3 }), true))
      .toBe('L')
  })

  it('owning team AWAY + away wins → W', () => {
    expect(resolveOutcome(game({ homeAway: 'AWAY', homeScore: 1, awayScore: 3 }), true))
      .toBe('W')
  })

  it('owning team AWAY + home wins → L', () => {
    expect(resolveOutcome(game({ homeAway: 'AWAY', homeScore: 3, awayScore: 1 }), true))
      .toBe('L')
  })

  it('equal scores → T regardless of side', () => {
    expect(resolveOutcome(game({ homeAway: 'HOME', homeScore: 2, awayScore: 2 }), true))
      .toBe('T')
    expect(resolveOutcome(game({ homeAway: 'AWAY', homeScore: 5, awayScore: 5 }), true))
      .toBe('T')
  })
})

describe('resolveOutcome — dual-school opponent viewpoint', () => {
  // Same row as above, but viewed from the *opponent* team's side.
  // Interpretation of homeAway flips: if the owner was HOME, the opponent was AWAY.

  it('owner HOME + home wins → opponent L (opponent was away and lost)', () => {
    expect(resolveOutcome(game({ homeAway: 'HOME', homeScore: 3, awayScore: 1 }), false))
      .toBe('L')
  })

  it('owner HOME + away wins → opponent W (opponent was away and won)', () => {
    expect(resolveOutcome(game({ homeAway: 'HOME', homeScore: 1, awayScore: 3 }), false))
      .toBe('W')
  })

  it('owner AWAY + home wins → opponent W (opponent was home and won)', () => {
    expect(resolveOutcome(game({ homeAway: 'AWAY', homeScore: 3, awayScore: 1 }), false))
      .toBe('W')
  })

  it('owner AWAY + away wins → opponent L (opponent was home and lost)', () => {
    expect(resolveOutcome(game({ homeAway: 'AWAY', homeScore: 1, awayScore: 3 }), false))
      .toBe('L')
  })

  it('tie is a tie from either viewpoint', () => {
    const tied = game({ homeAway: 'HOME', homeScore: 2, awayScore: 2 })
    expect(resolveOutcome(tied, true)).toBe('T')
    expect(resolveOutcome(tied, false)).toBe('T')
  })
})

describe('resolveOutcome — edge cases', () => {
  it('returns null when scores are missing', () => {
    expect(resolveOutcome(game({ homeScore: null, awayScore: 3 }), true)).toBeNull()
    expect(resolveOutcome(game({ homeScore: 3, awayScore: null }), true)).toBeNull()
    expect(resolveOutcome(game({ homeScore: null, awayScore: null }), false)).toBeNull()
  })

  it('dual-school symmetry: one side wins iff the other side loses', () => {
    const g = game({ homeAway: 'HOME', homeScore: 5, awayScore: 2 })
    expect(resolveOutcome(g, true)).toBe('W')
    expect(resolveOutcome(g, false)).toBe('L')
  })
})

// ── tallyForTeam ───────────────────────────────────────────────────────────

describe('tallyForTeam', () => {
  it('aggregates wins / losses / ties correctly for owning side', () => {
    const games = [
      game({ homeAway: 'HOME', homeScore: 3, awayScore: 1 }), // W
      game({ homeAway: 'HOME', homeScore: 1, awayScore: 3 }), // L
      game({ homeAway: 'AWAY', homeScore: 1, awayScore: 3 }), // W
      game({ homeAway: 'AWAY', homeScore: 3, awayScore: 1 }), // L
      game({ homeAway: 'HOME', homeScore: 2, awayScore: 2 }), // T
    ]
    expect(tallyForTeam(games, true)).toEqual({ wins: 2, losses: 2, ties: 1 })
  })

  it('aggregates wins / losses / ties correctly for opponent viewpoint', () => {
    // Same five games, opponent viewpoint: W↔L flip, T stays T.
    const games = [
      game({ homeAway: 'HOME', homeScore: 3, awayScore: 1 }), // L
      game({ homeAway: 'HOME', homeScore: 1, awayScore: 3 }), // W
      game({ homeAway: 'AWAY', homeScore: 1, awayScore: 3 }), // L
      game({ homeAway: 'AWAY', homeScore: 3, awayScore: 1 }), // W
      game({ homeAway: 'HOME', homeScore: 2, awayScore: 2 }), // T
    ]
    expect(tallyForTeam(games, false)).toEqual({ wins: 2, losses: 2, ties: 1 })
  })

  it('skips games without scores', () => {
    const games = [
      game({ homeAway: 'HOME', homeScore: null, awayScore: null }),
      game({ homeAway: 'HOME', homeScore: 3, awayScore: 1 }), // W
    ]
    expect(tallyForTeam(games, true)).toEqual({ wins: 1, losses: 0, ties: 0 })
  })

  it('empty input produces a zero tally', () => {
    expect(tallyForTeam([], true)).toEqual({ wins: 0, losses: 0, ties: 0 })
    expect(tallyForTeam([], false)).toEqual({ wins: 0, losses: 0, ties: 0 })
  })

  it('dual-school conservation: owner.W + opponent.W = total decisive games', () => {
    // A set of dual-school games. Each decisive game (non-tie) must contribute
    // exactly one W and one L across the two teams combined.
    const games = [
      game({ homeAway: 'HOME', homeScore: 7, awayScore: 2 }),
      game({ homeAway: 'AWAY', homeScore: 3, awayScore: 5 }),
      game({ homeAway: 'HOME', homeScore: 4, awayScore: 4 }), // tie — doesn't count
      game({ homeAway: 'AWAY', homeScore: 9, awayScore: 6 }),
    ]
    const owner = tallyForTeam(games, true)
    const opp = tallyForTeam(games, false)
    const decisive = games.filter(
      (g) => g.homeScore != null && g.awayScore != null && g.homeScore !== g.awayScore,
    ).length
    expect(owner.wins + opp.wins).toBe(decisive)
    expect(owner.losses + opp.losses).toBe(decisive)
    expect(owner.wins).toBe(opp.losses)
    expect(owner.losses).toBe(opp.wins)
    expect(owner.ties).toBe(opp.ties)
  })
})
