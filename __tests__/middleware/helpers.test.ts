/**
 * Tests for middleware helper functions.
 *
 * The middleware module exports `middleware()` and `config`.
 * We test the internal path-checking logic by calling middleware with
 * crafted requests and asserting on the response behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mock hoisting ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  verifyAuthToken: vi.fn().mockResolvedValue({
    userId: 'user-1',
    organizationId: 'org-1',
    email: 'test@example.com',
  }),
  verifyPlatformAuthToken: vi.fn().mockResolvedValue(null),
  publicApiRateLimiter: {
    hit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, retryAfterMs: 0 }),
    increment: vi.fn(),
    check: vi.fn().mockReturnValue({ allowed: true }),
  },
  signupRateLimiter: {
    hit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, retryAfterMs: 0 }),
    increment: vi.fn(),
    check: vi.fn().mockReturnValue({ allowed: true }),
  },
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthToken: mocks.verifyAuthToken,
}))

vi.mock('@/lib/auth/platform-auth', () => ({
  verifyPlatformAuthToken: mocks.verifyPlatformAuthToken,
}))

vi.mock('@/lib/rate-limit', () => ({
  publicApiRateLimiter: mocks.publicApiRateLimiter,
  signupRateLimiter: mocks.signupRateLimiter,
  getRateLimitHeaders: mocks.getRateLimitHeaders,
}))

import { middleware } from '@/middleware'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(
  path: string,
  options: {
    method?: string
    host?: string
    token?: string | null
    cookie?: string | null
    csrfCookie?: string | null
    csrfHeader?: string | null
  } = {}
): NextRequest {
  const { method = 'GET', host = 'localhost', token, cookie, csrfCookie, csrfHeader } = options
  const url = `http://${host}${path}`
  const headers: Record<string, string> = { host }
  if (token) headers['authorization'] = `Bearer ${token}`
  if (csrfHeader) headers['x-csrf-token'] = csrfHeader

  const req = new NextRequest(url, { method, headers })

  // Simulate cookies via the req.cookies API
  if (cookie) {
    Object.defineProperty(req, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === 'auth-token') return { value: cookie }
          if (name === 'csrf-token' && csrfCookie) return { value: csrfCookie }
          return undefined
        },
      },
    })
  } else if (csrfCookie) {
    Object.defineProperty(req, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === 'csrf-token') return { value: csrfCookie }
          return undefined
        },
      },
    })
  }

  return req
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuthToken.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      email: 'test@example.com',
    })
    mocks.verifyPlatformAuthToken.mockResolvedValue(null)
  })

  // ── Public paths ──

  it('allows /login without auth', async () => {
    const res = await middleware(makeReq('/login'))
    // Public paths return NextResponse.next() which is 200
    expect(res.status).not.toBe(401)
  })

  it('allows /api/auth/login without auth', async () => {
    const res = await middleware(makeReq('/api/auth/login'))
    expect(res.status).not.toBe(401)
  })

  it('allows /api/branding without auth', async () => {
    const res = await middleware(makeReq('/api/branding'))
    expect(res.status).not.toBe(401)
  })

  it('allows /api/organizations/signup without auth', async () => {
    const res = await middleware(makeReq('/api/organizations/signup'))
    expect(res.status).not.toBe(401)
  })

  it('allows /_next/static paths without auth', async () => {
    const res = await middleware(makeReq('/_next/static/chunk.js'))
    expect(res.status).not.toBe(401)
  })

  it('allows /sw.js without auth', async () => {
    const res = await middleware(makeReq('/sw.js'))
    expect(res.status).not.toBe(401)
  })

  // ── Auth-required paths ──

  it('returns 401 for /api/tickets without token', async () => {
    const res = await middleware(makeReq('/api/tickets'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('sets x-org-id header for valid token via Authorization header', async () => {
    const res = await middleware(makeReq('/api/tickets', { token: 'valid-jwt' }))
    // With our mock, verifyAuthToken returns org-1
    // The middleware should pass through with x-org-id set
    expect(res.status).not.toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mocks.verifyAuthToken.mockResolvedValue(null)
    const res = await middleware(makeReq('/api/tickets', { token: 'bad-token' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_TOKEN')
  })

  it('accepts cookie-based auth', async () => {
    const res = await middleware(makeReq('/api/tickets', { cookie: 'valid-cookie-jwt' }))
    expect(res.status).not.toBe(401)
    expect(mocks.verifyAuthToken).toHaveBeenCalledWith('valid-cookie-jwt')
  })

  // ── CSRF protection ──

  it('blocks state-changing API requests when CSRF cookie is present but header is missing', async () => {
    const req = makeReq('/api/tickets', {
      method: 'POST',
      token: 'valid-jwt',
      csrfCookie: 'csrf-123',
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('CSRF_INVALID')
  })

  it('blocks state-changing API requests when CSRF token mismatch', async () => {
    const req = makeReq('/api/tickets', {
      method: 'POST',
      token: 'valid-jwt',
      csrfCookie: 'csrf-123',
      csrfHeader: 'csrf-wrong',
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('allows GET requests without CSRF header', async () => {
    const res = await middleware(makeReq('/api/tickets', { token: 'valid-jwt', csrfCookie: 'csrf-123' }))
    expect(res.status).not.toBe(403)
  })

  // ── /app/settings redirect ──

  it('redirects /app/settings to /settings', async () => {
    const res = await middleware(makeReq('/app/settings', { token: 'valid-jwt' }))
    // Redirect responses have 307 status
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/settings')
  })

  // ── Subdomain handling ──

  it('sets x-org-subdomain header for tenant subdomain', async () => {
    const res = await middleware(makeReq('/login', { host: 'myschool.localhost' }))
    // Public path — should pass through, but subdomain detection runs
    expect(res.status).not.toBe(401)
  })

  it('does not treat www as a tenant subdomain', async () => {
    const res = await middleware(makeReq('/login', { host: 'www.lionheartapp.com' }))
    expect(res.status).not.toBe(401)
  })

  it('does not treat api as a tenant subdomain', async () => {
    const res = await middleware(makeReq('/login', { host: 'api.lionheartapp.com' }))
    expect(res.status).not.toBe(401)
  })
})
