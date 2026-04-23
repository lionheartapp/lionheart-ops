/**
 * Tests for the `withAuth` wrapper's error-classification pipeline.
 *
 * Builds a minimal handler that throws representative errors, then verifies
 * that the wrapper maps each to the correct HTTP status + code without
 * leaking 5xx responses to clients. Complements the unit tests for
 * `classifyServiceError` by covering the `withAuth` pathway used by most
 * API routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

// ── Mocks (hoisted; no DB / permission side effects) ────────────────────────

vi.mock('@/lib/request-context', () => ({
  getUserContext: vi.fn().mockResolvedValue({
    userId: 'user-test-1',
    organizationId: 'org-test-1',
    email: 'test@example.com',
    roleName: 'admin',
    orgTrialEndsAt: null,
    orgSubscriptionStatus: 'ACTIVE',
  }),
}))

vi.mock('@/lib/auth/permissions', () => ({
  assertCan: vi.fn().mockResolvedValue(undefined),
  can: vi.fn().mockResolvedValue(true),
  canAny: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/org-context', () => ({
  getOrgIdFromRequest: vi.fn().mockReturnValue('org-test-1'),
  runWithOrgContext: vi.fn().mockImplementation((_orgId: string, fn: () => unknown) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@sentry/nextjs', () => ({
  setTag: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@/lib/trial-utils', () => ({
  getTrialState: vi.fn().mockReturnValue({ readOnly: false }),
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import { withAuth } from '@/lib/api/with-auth'

function buildThrowingRoute(error: unknown) {
  const handler = withAuth(async () => {
    throw error
  })
  return handler
}

async function invoke(handler: ReturnType<typeof buildThrowingRoute>, method = 'GET') {
  const req = new NextRequest('http://localhost/api/test', { method })
  // Cast to align with the wrapper's handler signature
  return (handler as unknown as (r: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<NextResponse>)(
    req,
    { params: Promise.resolve({}) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Auth errors → 401 ───────────────────────────────────────────────────────

describe('withAuth classification — auth errors', () => {
  it('returns 401 for "Missing or invalid authorization"', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Missing or invalid authorization')))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 for "Invalid or expired token"', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Invalid or expired token')))
    expect(res.status).toBe(401)
  })
})

// ── Zod validation → 400 ────────────────────────────────────────────────────

describe('withAuth classification — validation errors', () => {
  it('returns 400 with details for ZodError', async () => {
    const zodErr = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['name'],
        message: 'Expected string',
      },
    ])
    const res = await invoke(buildThrowingRoute(zodErr))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toBeTruthy()
  })
})

// ── Permission → 403 ────────────────────────────────────────────────────────

describe('withAuth classification — permission errors', () => {
  it('returns 403 for "Permission denied"', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Permission denied: users:invite')))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
    // Never leak the internal permission name
    expect(body.error.message).not.toContain('users:invite')
  })

  it('returns 403 for "Insufficient permissions"', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Insufficient permissions for resource')))
    expect(res.status).toBe(403)
  })
})

// ── Not found → 404 ─────────────────────────────────────────────────────────

describe('withAuth classification — not-found errors', () => {
  it('returns 404 for "not found" message', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Widget not found')))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 for "does not exist"', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Record does not exist')))
    expect(res.status).toBe(404)
  })

  it('returns 404 for "no active assignment"', async () => {
    const res = await invoke(
      buildThrowingRoute(new Error('NO_ACTIVE_ASSIGNMENT: no active assignment found')),
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 for Prisma P2025', async () => {
    const err = Object.assign(new Error('Prisma update not found'), { code: 'P2025' })
    const res = await invoke(buildThrowingRoute(err))
    expect(res.status).toBe(404)
  })
})

// ── Bad request → 400 ───────────────────────────────────────────────────────

describe('withAuth classification — bad-request business errors', () => {
  it('returns 400 for SYNC_NOT_CONFIGURED', async () => {
    const res = await invoke(
      buildThrowingRoute(new Error('SYNC_NOT_CONFIGURED: No Google Admin sync configuration')),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 for UNKNOWN_PROVIDER', async () => {
    const res = await invoke(
      buildThrowingRoute(new Error('UNKNOWN_PROVIDER: Roster sync provider "foo" is not supported.')),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for Prisma P2003 (FK violation)', async () => {
    const err = Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' })
    const res = await invoke(buildThrowingRoute(err))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })
})

// ── Conflict → 409 ──────────────────────────────────────────────────────────

describe('withAuth classification — conflict errors', () => {
  it('returns 409 for Prisma P2002 with target field', async () => {
    const err = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['slug'] },
    })
    const res = await invoke(buildThrowingRoute(err))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toContain('slug')
  })

  it('returns 409 for "is already taken"', async () => {
    const res = await invoke(
      buildThrowingRoute(new Error("Share slug 'foo' is already taken")),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('returns 409 for "already exists"', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Record already exists')))
    expect(res.status).toBe(409)
  })
})

// ── Fallback → 500 ──────────────────────────────────────────────────────────

describe('withAuth classification — fallback', () => {
  it('returns 500 for unrecognized Error', async () => {
    const res = await invoke(buildThrowingRoute(new Error('Unexpected runtime issue')))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    // Catch-all must not leak the internal error message
    expect(body.error.message).not.toContain('Unexpected runtime issue')
  })

  it('returns 500 for non-Error throw', async () => {
    const res = await invoke(buildThrowingRoute('plain string'))
    expect(res.status).toBe(500)
  })
})
