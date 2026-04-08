import { describe, it, expect } from 'vitest'
import { BOARD_ALLOWED_TRANSITIONS, isBoardTransitionAllowed } from '@/lib/maintenance-transitions'

describe('BOARD_ALLOWED_TRANSITIONS', () => {
  it('defines transitions for all expected statuses', () => {
    const statuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'SCHEDULED', 'QA', 'DONE', 'CANCELLED']
    for (const status of statuses) {
      expect(BOARD_ALLOWED_TRANSITIONS).toHaveProperty(status)
    }
  })

  it('DONE and CANCELLED are terminal (no outgoing transitions)', () => {
    expect(BOARD_ALLOWED_TRANSITIONS['DONE']).toEqual([])
    expect(BOARD_ALLOWED_TRANSITIONS['CANCELLED']).toEqual([])
  })

  it('every status can transition to CANCELLED (except DONE and CANCELLED)', () => {
    const nonTerminal = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'SCHEDULED', 'QA']
    for (const status of nonTerminal) {
      expect(BOARD_ALLOWED_TRANSITIONS[status]).toContain('CANCELLED')
    }
  })
})

describe('isBoardTransitionAllowed', () => {
  // Valid transitions
  it('allows BACKLOG → TODO', () => {
    expect(isBoardTransitionAllowed('BACKLOG', 'TODO')).toBe(true)
  })

  it('allows TODO → IN_PROGRESS', () => {
    expect(isBoardTransitionAllowed('TODO', 'IN_PROGRESS')).toBe(true)
  })

  it('allows IN_PROGRESS → DONE', () => {
    expect(isBoardTransitionAllowed('IN_PROGRESS', 'DONE')).toBe(true)
  })

  it('allows IN_PROGRESS → QA', () => {
    expect(isBoardTransitionAllowed('IN_PROGRESS', 'QA')).toBe(true)
  })

  it('allows QA → DONE', () => {
    expect(isBoardTransitionAllowed('QA', 'DONE')).toBe(true)
  })

  it('allows QA → IN_PROGRESS (send back)', () => {
    expect(isBoardTransitionAllowed('QA', 'IN_PROGRESS')).toBe(true)
  })

  it('allows ON_HOLD → TODO', () => {
    expect(isBoardTransitionAllowed('ON_HOLD', 'TODO')).toBe(true)
  })

  it('allows SCHEDULED → IN_PROGRESS', () => {
    expect(isBoardTransitionAllowed('SCHEDULED', 'IN_PROGRESS')).toBe(true)
  })

  // Invalid transitions
  it('blocks BACKLOG → DONE (skip steps)', () => {
    expect(isBoardTransitionAllowed('BACKLOG', 'DONE')).toBe(false)
  })

  it('blocks DONE → TODO (terminal status)', () => {
    expect(isBoardTransitionAllowed('DONE', 'TODO')).toBe(false)
  })

  it('blocks CANCELLED → TODO (terminal status)', () => {
    expect(isBoardTransitionAllowed('CANCELLED', 'TODO')).toBe(false)
  })

  it('blocks QA → BACKLOG', () => {
    expect(isBoardTransitionAllowed('QA', 'BACKLOG')).toBe(false)
  })

  // Edge cases
  it('returns false for unknown source status', () => {
    expect(isBoardTransitionAllowed('UNKNOWN', 'TODO')).toBe(false)
  })

  it('returns false for unknown target status', () => {
    expect(isBoardTransitionAllowed('TODO', 'UNKNOWN')).toBe(false)
  })

  it('returns false for self-transitions', () => {
    expect(isBoardTransitionAllowed('TODO', 'TODO')).toBe(false)
  })
})
