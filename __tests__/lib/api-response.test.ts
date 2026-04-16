import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { ok, fail, isAuthError, classifyServiceError } from '@/lib/api-response'
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

// ── classifyServiceError() ──────────────────────────────────────────────────

describe('classifyServiceError', () => {
  it('classifies auth errors as 401', () => {
    const classified = classifyServiceError(new Error('Missing or invalid authorization header'))
    expect(classified.status).toBe(401)
    expect(classified.body.error.code).toBe('UNAUTHORIZED')
  })

  it('classifies permission errors as 403', () => {
    const classified = classifyServiceError(new Error('Insufficient permissions'))
    expect(classified.status).toBe(403)
    expect(classified.body.error.code).toBe('FORBIDDEN')
  })

  it('classifies ZodError as 400 with issues detail', () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number',
      },
    ])
    const classified = classifyServiceError(zodError)
    expect(classified.status).toBe(400)
    expect(classified.body.error.code).toBe('VALIDATION_ERROR')
    expect(classified.body.error.details).toBeTruthy()
  })

  it('classifies Prisma P2025 as 404', () => {
    const prismaError = Object.assign(new Error('Record to update not found.'), {
      code: 'P2025',
    })
    const classified = classifyServiceError(prismaError)
    expect(classified.status).toBe(404)
    expect(classified.body.error.code).toBe('NOT_FOUND')
  })

  it('classifies Prisma P2002 as 409 and reports conflicting field', () => {
    const prismaError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['email'] },
    })
    const classified = classifyServiceError(prismaError)
    expect(classified.status).toBe(409)
    expect(classified.body.error.code).toBe('CONFLICT')
    expect(classified.body.error.message).toContain('email')
  })

  it('classifies Prisma P2003 as 400 BAD_REQUEST', () => {
    const prismaError = Object.assign(new Error('Foreign key constraint failed'), {
      code: 'P2003',
    })
    const classified = classifyServiceError(prismaError)
    expect(classified.status).toBe(400)
    expect(classified.body.error.code).toBe('BAD_REQUEST')
  })

  it('classifies "not found" message errors as 404', () => {
    const classified = classifyServiceError(new Error('Academic year not found'))
    expect(classified.status).toBe(404)
    expect(classified.body.error.code).toBe('NOT_FOUND')
  })

  it('classifies "does not exist" message errors as 404', () => {
    const classified = classifyServiceError(new Error('The referenced resource does not exist'))
    expect(classified.status).toBe(404)
  })

  it('classifies "no active assignment" as 404', () => {
    const classified = classifyServiceError(
      new Error('NO_ACTIVE_ASSIGNMENT: No active assignment found for this device.')
    )
    expect(classified.status).toBe(404)
  })

  it('classifies "is already taken" as 409', () => {
    const classified = classifyServiceError(new Error("Share slug 'hello' is already taken"))
    expect(classified.status).toBe(409)
    expect(classified.body.error.code).toBe('CONFLICT')
  })

  it('classifies "already exists" as 409', () => {
    const classified = classifyServiceError(new Error('Record already exists for this period'))
    expect(classified.status).toBe(409)
  })

  it('classifies "not configured" errors as 400', () => {
    const classified = classifyServiceError(
      new Error('SYNC_NOT_CONFIGURED: No Google Admin sync configuration found')
    )
    expect(classified.status).toBe(400)
    expect(classified.body.error.code).toBe('BAD_REQUEST')
  })

  it('classifies unknown provider errors as 400', () => {
    const classified = classifyServiceError(
      new Error('UNKNOWN_PROVIDER: Roster sync provider "foo" is not supported.')
    )
    expect(classified.status).toBe(400)
  })

  it('falls back to 500 INTERNAL_ERROR with custom message', () => {
    const classified = classifyServiceError(new Error('Totally unexpected'), 'Failed to do thing')
    expect(classified.status).toBe(500)
    expect(classified.body.error.code).toBe('INTERNAL_ERROR')
    expect(classified.body.error.message).toBe('Failed to do thing')
  })

  it('falls back to 500 for non-Error values', () => {
    const classified = classifyServiceError('a string error')
    expect(classified.status).toBe(500)
    expect(classified.body.error.code).toBe('INTERNAL_ERROR')
  })

  it('prefers auth over permission classification', () => {
    // Auth error pattern takes precedence
    const classified = classifyServiceError(
      new Error('Missing or invalid authorization: Insufficient permissions')
    )
    expect(classified.status).toBe(401)
  })
})
