import { describe, it, expect } from 'vitest'
import { resolveStatusConflict, resolveCommentConflict } from '@/lib/offline/conflicts'

// ── resolveStatusConflict ────────────────────────────────────────────────────

describe('resolveStatusConflict', () => {
  const earlier = new Date('2026-01-01T10:00:00Z')
  const later = new Date('2026-01-01T11:00:00Z')

  it('returns local status when local update is newer', () => {
    expect(resolveStatusConflict('IN_PROGRESS', 'TODO', later, earlier)).toBe('IN_PROGRESS')
  })

  it('returns server status when server update is newer', () => {
    expect(resolveStatusConflict('IN_PROGRESS', 'DONE', earlier, later)).toBe('DONE')
  })

  it('returns server status on tie (equal timestamps)', () => {
    const same = new Date('2026-01-01T10:00:00Z')
    expect(resolveStatusConflict('LOCAL', 'SERVER', same, same)).toBe('SERVER')
  })

  it('handles various status strings', () => {
    expect(resolveStatusConflict('CANCELLED', 'BACKLOG', later, earlier)).toBe('CANCELLED')
  })
})

// ── resolveCommentConflict ───────────────────────────────────────────────────

describe('resolveCommentConflict', () => {
  it('appends new local comments to server list', () => {
    const local = ['comment A', 'comment B']
    const server = ['comment A']
    const result = resolveCommentConflict(local, server)
    expect(result).toEqual(['comment A', 'comment B'])
  })

  it('does not duplicate existing comments', () => {
    const local = ['same', 'same']
    const server = ['same']
    const result = resolveCommentConflict(local, server)
    expect(result).toEqual(['same'])
  })

  it('preserves server comment order', () => {
    const local = ['new']
    const server = ['first', 'second']
    const result = resolveCommentConflict(local, server)
    expect(result).toEqual(['first', 'second', 'new'])
  })

  it('returns server comments when local has nothing new', () => {
    const local = ['a', 'b']
    const server = ['a', 'b']
    const result = resolveCommentConflict(local, server)
    expect(result).toEqual(['a', 'b'])
  })

  it('handles empty local array', () => {
    const result = resolveCommentConflict([], ['server-only'])
    expect(result).toEqual(['server-only'])
  })

  it('handles empty server array', () => {
    const result = resolveCommentConflict(['local-only'], [])
    expect(result).toEqual(['local-only'])
  })

  it('handles both arrays empty', () => {
    expect(resolveCommentConflict([], [])).toEqual([])
  })

  it('appends multiple new local comments', () => {
    const local = ['a', 'b', 'c']
    const server = ['a']
    expect(resolveCommentConflict(local, server)).toEqual(['a', 'b', 'c'])
  })
})
