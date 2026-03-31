/**
 * Unit tests for the withAuth route handler wrapper.
 *
 * Validates: auth flow, permission gating, Zod validation,
 * error classification (401/400/403/404/409/500), dynamic params,
 * searchParams, and permissionAny.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── Mock hoisting ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getOrgIdFromRequest: vi.fn().mockReturnValue('org-1'),
  getUserContext: vi.fn().mockResolvedValue({
    userId: 'user-1',
    organizationId: 'org-1',
    email: 'test@example.com',
    roleName: 'admin',
  }),
  assertCan: vi.fn().mockResolvedValue(undefined),
  can: vi.fn().mockResolvedValue(true),
  canAny: vi.fn().mockResolvedValue(true),
  runWithOrgContext: vi.fn().mockImplementation((_orgId: string, fn: () => unknown) => fn()),
}))

vi.mock('@/lib/org-context', () => ({
  getOrgIdFromRequest: mocks.getOrgIdFromRequest,
  runWithOrgContext: mocks.runWithOrgContext,
}))

vi.mock('@/lib/request-context', () => ({
  getUserContext: mocks.getUserContext,
}))

vi.mock('@/lib/auth/permissions', () => ({
  assertCan: mocks.assertCan,
  can: mocks.can,
  canAny: mocks.canAny,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    }),
  },
}))

vi.mock('@sentry/nextjs', () => ({
  setTag: vi.fn(),
  captureException: vi.fn(),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { withAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api-response'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(path = '/api/test', method = 'GET', body?: unknown): NextRequest {
  const opts: RequestInit = { method }
  if (body) {
    opts.body = JSON.stringify(body)
    opts.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(`http://localhost${path}`, opts)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore happy-path defaults
    mocks.getOrgIdFromRequest.mockReturnValue('org-1')
    mocks.getUserContext.mockResolvedValue({
      userId: 'user-1', organizationId: 'org-1',
      email: 'test@example.com', roleName: 'admin',
    })
    mocks.assertCan.mockResolvedValue(undefined)
    mocks.canAny.mockResolvedValue(true)
    mocks.runWithOrgContext.mockImplementation((_orgId: string, fn: () => unknown) => fn())
  })

  // ── Happy path ──

  it('calls handler with correct context', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json(ok('hello')))
    const wrapped = withAuth(handler)

    const res = await wrapped(makeReq('/api/test?foo=bar'))
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)

    const ctx = handler.mock.calls[0][0]
    expect(ctx.orgId).toBe('org-1')
    expect(ctx.ctx.userId).toBe('user-1')
    expect(ctx.searchParams.get('foo')).toBe('bar')
  })

  it('wraps handler in runWithOrgContext', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json(ok('ok')))
    const wrapped = withAuth(handler)

    await wrapped(makeReq())

    expect(mocks.runWithOrgContext).toHaveBeenCalledWith('org-1', expect.any(Function))
  })

  // ── Permission gating ──

  it('calls assertCan when permission option is set', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json(ok('ok')))
    const wrapped = withAuth(handler, { permission: 'teams:read' })

    await wrapped(makeReq())

    expect(mocks.assertCan).toHaveBeenCalledWith('user-1', 'teams:read')
  })

  it('returns 403 when assertCan throws permission error', async () => {
    mocks.assertCan.mockRejectedValue(new Error('Insufficient permissions'))
    const handler = vi.fn()
    const wrapped = withAuth(handler, { permission: 'teams:read' })

    const res = await wrapped(makeReq())

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('FORBIDDEN')
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when permissionAny fails', async () => {
    mocks.canAny.mockResolvedValue(false)
    const handler = vi.fn()
    const wrapped = withAuth(handler, { permissionAny: ['teams:read', 'teams:manage'] })

    const res = await wrapped(makeReq())

    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('passes when permissionAny succeeds', async () => {
    mocks.canAny.mockResolvedValue(true)
    const handler = vi.fn().mockResolvedValue(NextResponse.json(ok('ok')))
    const wrapped = withAuth(handler, { permissionAny: ['teams:read', 'teams:manage'] })

    const res = await wrapped(makeReq())

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // ── Auth errors → 401 ──

  it('returns 401 when getUserContext throws auth error', async () => {
    mocks.getUserContext.mockRejectedValue(new Error('Missing or invalid authorization'))
    const handler = vi.fn()
    const wrapped = withAuth(handler)

    const res = await wrapped(makeReq())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 for expired token error', async () => {
    mocks.getUserContext.mockRejectedValue(new Error('Invalid or expired token'))
    const handler = vi.fn()
    const wrapped = withAuth(handler)

    const res = await wrapped(makeReq())

    expect(res.status).toBe(401)
  })

  // ── Zod validation → 400 ──

  it('parses and validates body when schema is provided', async () => {
    const schema = z.object({ name: z.string().min(1) })
    const handler = vi.fn().mockImplementation(({ body }) =>
      NextResponse.json(ok(body))
    )
    const wrapped = withAuth(handler, { schema })

    const res = await wrapped(makeReq('/api/test', 'POST', { name: 'Test' }))
    const data = await res.json()

    expect(data.ok).toBe(true)
    expect(data.data.name).toBe('Test')
  })

  it('returns 400 when schema validation fails', async () => {
    const schema = z.object({ name: z.string().min(1) })
    const handler = vi.fn()
    const wrapped = withAuth(handler, { schema })

    const res = await wrapped(makeReq('/api/test', 'POST', { name: '' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(handler).not.toHaveBeenCalled()
  })

  // ── Not found → 404 ──

  it('returns 404 when handler throws not found error', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Record not found'))
    const wrapped = withAuth(handler)

    const res = await wrapped(makeReq())

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  // ── Prisma unique constraint → 409 ──

  it('returns 409 for Prisma unique constraint violation', async () => {
    const prismaError = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['email'] },
    })
    const handler = vi.fn().mockRejectedValue(prismaError)
    const wrapped = withAuth(handler)

    const res = await wrapped(makeReq())

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toContain('email')
  })

  // ── Catch-all → 500 ──

  it('returns 500 for unknown errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Something unexpected'))
    const wrapped = withAuth(handler)

    const res = await wrapped(makeReq())

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  // ── Dynamic params ──

  it('resolves and passes dynamic route params', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json(ok('ok')))
    const wrapped = withAuth(handler)

    await wrapped(makeReq(), { params: Promise.resolve({ id: 'abc-123' }) })

    const ctx = handler.mock.calls[0][0]
    expect(ctx.params.id).toBe('abc-123')
  })

  it('defaults params to empty object when not provided', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json(ok('ok')))
    const wrapped = withAuth(handler)

    await wrapped(makeReq())

    const ctx = handler.mock.calls[0][0]
    expect(ctx.params).toEqual({})
  })

  // ── Permission helpers in context ──

  it('provides scoped can() and canAny() in context', async () => {
    const handler = vi.fn().mockImplementation(async ({ permissions }) => {
      const result = await permissions.can('teams:read')
      return NextResponse.json(ok(result))
    })
    const wrapped = withAuth(handler)

    await wrapped(makeReq())

    expect(mocks.can).toHaveBeenCalledWith('user-1', 'teams:read')
  })
})
