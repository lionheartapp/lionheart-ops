import { describe, it, expect } from 'vitest'
import { ok, fail, isAuthError } from '@/lib/api-response'
import type { ApiSuccess, ApiFailure, ApiResult } from '@/lib/api-response'

// ── ok() ────────────────────────────────────────────────────────────────────

describe('ok', () => {
  it('wraps data in success envelope', () => {
    const result = ok({ users: ['Alice'] })
    expect(result).toEqual({ ok: true, data: { users: ['Alice'] } })
  })

  it('includes meta when provided', () => {
    const result = ok([1, 2, 3], { total: 3, page: 1 })
    expect(result).toEqual({
      ok: true,
      data: [1, 2, 3],
      meta: { total: 3, page: 1 },
    })
  })

  it('omits meta key when not provided', () => {
    const result = ok('simple')
    expect(result).not.toHaveProperty('meta')
  })

  it('works with null data', () => {
    const result = ok(null)
    expect(result).toEqual({ ok: true, data: null })
  })

  it('type narrows correctly', () => {
    const result: ApiResult<string> = ok('hello')
    if (result.ok) {
      expect(result.data).toBe('hello')
    }
  })
})

// ── fail() ──────────────────────────────────────────────────────────────────

describe('fail', () => {
  it('wraps error in failure envelope', () => {
    const result = fail('NOT_FOUND', 'User not found')
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    })
  })

  it('includes details when provided', () => {
    const result = fail('VALIDATION_ERROR', 'Invalid input', [
      { field: 'email', message: 'Required' },
    ])
    expect(result.error.details).toEqual([
      { field: 'email', message: 'Required' },
    ])
  })

  it('omits details key when not provided', () => {
    const result = fail('INTERNAL_ERROR', 'Something went wrong')
    expect(result.error).not.toHaveProperty('details')
  })

  it('type narrows correctly', () => {
    const result: ApiResult<string> = fail('ERR', 'bad')
    if (!result.ok) {
      expect(result.error.code).toBe('ERR')
    }
  })
})

// ── isAuthError() ───────────────────────────────────────────────────────────

describe('isAuthError', () => {
  it('returns true for "Missing or invalid authorization"', () => {
    expect(isAuthError(new Error('Missing or invalid authorization'))).toBe(true)
  })

  it('returns true for "Invalid or expired token"', () => {
    expect(isAuthError(new Error('Invalid or expired token'))).toBe(true)
  })

  it('returns true for "User not found"', () => {
    expect(isAuthError(new Error('User not found'))).toBe(true)
  })

  it('returns true for "Missing x-org-id"', () => {
    expect(isAuthError(new Error('Missing x-org-id'))).toBe(true)
  })

  it('returns true when pattern is embedded in longer message', () => {
    expect(isAuthError(new Error('Error: Missing or invalid authorization header'))).toBe(true)
  })

  it('returns false for non-auth errors', () => {
    expect(isAuthError(new Error('Database connection failed'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isAuthError('string error')).toBe(false)
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
    expect(isAuthError(42)).toBe(false)
  })

  it('returns false for object that is not an Error', () => {
    expect(isAuthError({ message: 'Missing or invalid authorization' })).toBe(false)
  })
})
