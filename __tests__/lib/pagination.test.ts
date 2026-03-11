import { describe, it, expect } from 'vitest'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import type { PaginationParams } from '@/lib/pagination'

describe('parsePagination', () => {
  it('returns defaults when no params provided', () => {
    const result = parsePagination(new URLSearchParams())
    expect(result).toEqual({ page: 1, limit: 25, skip: 0 })
  })

  it('parses page and limit correctly', () => {
    const result = parsePagination(new URLSearchParams('page=3&limit=10'))
    expect(result).toEqual({ page: 3, limit: 10, skip: 20 })
  })

  it('clamps page=0 to page=1', () => {
    const result = parsePagination(new URLSearchParams('page=0'))
    expect(result.page).toBe(1)
    expect(result.skip).toBe(0)
  })

  it('clamps limit=500 to maxLimit=100 by default', () => {
    const result = parsePagination(new URLSearchParams('limit=500'))
    expect(result.limit).toBe(100)
  })

  it('clamps limit=-5 to 1', () => {
    const result = parsePagination(new URLSearchParams('limit=-5'))
    expect(result.limit).toBe(1)
  })

  it('handles non-numeric page gracefully (defaults to 1)', () => {
    const result = parsePagination(new URLSearchParams('page=abc'))
    expect(result.page).toBe(1)
    expect(result.skip).toBe(0)
  })

  it('handles non-numeric limit gracefully (defaults to defaultLimit)', () => {
    const result = parsePagination(new URLSearchParams('limit=abc'))
    expect(result.limit).toBe(25)
  })

  it('computes skip correctly for page=2, limit=25', () => {
    const result = parsePagination(new URLSearchParams('page=2&limit=25'))
    expect(result.skip).toBe(25)
  })

  it('respects custom defaultLimit', () => {
    const result = parsePagination(new URLSearchParams(), 50)
    expect(result.limit).toBe(50)
  })

  it('respects custom maxLimit', () => {
    const result = parsePagination(new URLSearchParams('limit=200'), 25, 150)
    expect(result.limit).toBe(150)
  })
})

describe('paginationMeta', () => {
  it('returns correct meta for 100 total with page=1, limit=25', () => {
    const params: PaginationParams = { page: 1, limit: 25, skip: 0 }
    const result = paginationMeta(100, params)
    expect(result).toEqual({ total: 100, page: 1, limit: 25, totalPages: 4 })
  })

  it('returns totalPages=0 when total is 0', () => {
    const params: PaginationParams = { page: 1, limit: 25, skip: 0 }
    const result = paginationMeta(0, params)
    expect(result.totalPages).toBe(0)
  })

  it('rounds up totalPages for uneven division', () => {
    const params: PaginationParams = { page: 1, limit: 10, skip: 0 }
    const result = paginationMeta(25, params)
    expect(result.totalPages).toBe(3)
  })

  it('returns totalPages=1 when total < limit', () => {
    const params: PaginationParams = { page: 1, limit: 25, skip: 0 }
    const result = paginationMeta(10, params)
    expect(result.totalPages).toBe(1)
  })

  it('preserves page and limit in meta', () => {
    const params: PaginationParams = { page: 2, limit: 10, skip: 10 }
    const result = paginationMeta(50, params)
    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
  })
})
