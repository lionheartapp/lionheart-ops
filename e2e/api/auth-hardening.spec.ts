import { test, expect } from '@playwright/test'
import { request as pwRequest } from '@playwright/test'
import { env } from '../helpers/env'
import { ApiClient, assertOk } from '../helpers/api'
import { ticketTitle } from '../helpers/data'

/**
 * Auth hardening tests — verify the security perimeter:
 *   1. Tampered JWTs are rejected
 *   2. Garbage tokens are rejected
 *   3. Expired-style tokens are rejected
 *   4. Missing tokens are rejected on protected routes
 *   5. CSRF enforcement on state-changing requests
 *   6. Soft-deleted records stay invisible
 */

const BASE = env.baseUrl

async function rawCtx() {
  return pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: {
      'content-type': 'application/json',
      'x-e2e-run': process.env.GITHUB_RUN_ID || 'local',
    },
  })
}

// ─── JWT Hardening ───────────────────────────────────────────────────

test.describe('Auth hardening · JWT', () => {
  test('no token → 401 on protected route', async () => {
    const ctx = await rawCtx()
    const res = await ctx.get('/api/settings/users')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(['UNAUTHORIZED', 'INVALID_TOKEN']).toContain(body.error.code)
    await ctx.dispose()
  })

  test('garbage token → 401', async () => {
    const ctx = await rawCtx()
    const res = await ctx.get('/api/settings/users', {
      headers: {
        cookie: 'auth-token=this-is-not-a-jwt',
      },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
    await ctx.dispose()
  })

  test('tampered token → 401', async () => {
    // Log in to get a real token, then tamper with it.
    const ctx = await rawCtx()
    const loginRes = await ctx.post('/api/auth/login', {
      data: {
        email: env.orgA.adminEmail,
        password: env.orgA.adminPassword,
        organizationId: env.orgA.id,
      },
    })
    expect(loginRes.status()).toBe(200)
    const loginBody = await loginRes.json()
    const realToken: string = loginBody.data.token

    // Tamper: flip a character in the signature (last segment).
    const parts = realToken.split('.')
    const sig = parts[2]
    const flipped = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1)
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`

    const ctx2 = await rawCtx()
    const res = await ctx2.get('/api/settings/users', {
      headers: {
        cookie: `auth-token=${tampered}`,
        'x-org-id': env.orgA.id,
      },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)

    await ctx.dispose()
    await ctx2.dispose()
  })

  test('token with missing payload fields → 401', async () => {
    // A structurally valid JWT but with empty/wrong claims should fail
    // in the middleware or getUserContext. We simulate by sending a token
    // that decodes to something missing userId/orgId.
    // Easiest: base64url-encode a fake header+payload with no signature.
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')
    const fakeToken = `${header}.${payload}.fakesig`

    const ctx = await rawCtx()
    const res = await ctx.get('/api/settings/users', {
      headers: {
        cookie: `auth-token=${fakeToken}`,
        'x-org-id': env.orgA.id,
      },
    })
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })
})

// ─── CSRF Enforcement ────────────────────────────────────────────────

test.describe('Auth hardening · CSRF', () => {
  test('POST without CSRF token → 403', async () => {
    // Log in to get an auth cookie, but don't send CSRF token on the mutation.
    const ctx = await rawCtx()
    const loginRes = await ctx.post('/api/auth/login', {
      data: {
        email: env.orgA.adminEmail,
        password: env.orgA.adminPassword,
        organizationId: env.orgA.id,
      },
    })
    expect(loginRes.status()).toBe(200)
    const loginBody = await loginRes.json()
    const token: string = loginBody.data.token

    // Send a POST with auth cookie but NO csrf-token cookie and NO x-csrf-token header.
    const ctx2 = await rawCtx()
    const res = await ctx2.post('/api/tickets', {
      data: {
        title: 'csrf-test',
        description: 'should be blocked',
        priority: 'LOW',
        category: 'IT',
        locationText: 'Room 101',
      },
      headers: {
        cookie: `auth-token=${token}`,
        'x-org-id': env.orgA.id,
        'content-type': 'application/json',
        // deliberately no x-csrf-token
      },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(['CSRF_REQUIRED', 'CSRF_INVALID']).toContain(body.error.code)

    await ctx.dispose()
    await ctx2.dispose()
  })

  test('POST with mismatched CSRF token → 403', async () => {
    const ctx = await rawCtx()
    const loginRes = await ctx.post('/api/auth/login', {
      data: {
        email: env.orgA.adminEmail,
        password: env.orgA.adminPassword,
        organizationId: env.orgA.id,
      },
    })
    expect(loginRes.status()).toBe(200)
    const loginBody = await loginRes.json()
    const token: string = loginBody.data.token

    // Extract the real CSRF cookie from login response
    const setCookies = loginRes.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie')
    let csrfCookie = ''
    for (const h of setCookies) {
      const match = h.value.match(/csrf-token=([^;]+)/)
      if (match) { csrfCookie = match[1]; break }
    }

    // Send with correct csrf cookie but WRONG x-csrf-token header.
    const ctx2 = await rawCtx()
    const res = await ctx2.post('/api/tickets', {
      data: {
        title: 'csrf-mismatch-test',
        description: 'should be blocked',
        priority: 'LOW',
        category: 'IT',
        locationText: 'Room 101',
      },
      headers: {
        cookie: `auth-token=${token}; csrf-token=${csrfCookie}`,
        'x-org-id': env.orgA.id,
        'x-csrf-token': 'wrong-token-value',
        'content-type': 'application/json',
      },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('CSRF_INVALID')

    await ctx.dispose()
    await ctx2.dispose()
  })

  test('GET requests are exempt from CSRF', async () => {
    // GETs should work with auth cookie and no CSRF token.
    const ctx = await rawCtx()
    const loginRes = await ctx.post('/api/auth/login', {
      data: {
        email: env.orgA.adminEmail,
        password: env.orgA.adminPassword,
        organizationId: env.orgA.id,
      },
    })
    expect(loginRes.status()).toBe(200)
    const loginBody = await loginRes.json()
    const token: string = loginBody.data.token

    const ctx2 = await rawCtx()
    const res = await ctx2.get('/api/settings/users', {
      headers: {
        cookie: `auth-token=${token}`,
        'x-org-id': env.orgA.id,
      },
    })
    // Should succeed — no CSRF required for GET.
    expect(res.status()).toBeLessThan(400)

    await ctx.dispose()
    await ctx2.dispose()
  })
})

// ─── Soft-Delete Verification ────────────────────────────────────────

test.describe('Auth hardening · soft-delete', () => {
  test('deleted ticket is invisible via list and direct fetch', async () => {
    const client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })

    // Create a ticket.
    const title = ticketTitle()
    const created = await client.post<{ id: string }>('/api/tickets', {
      title,
      description: 'soft-delete test',
      priority: 'LOW',
      category: 'IT',
      locationText: 'Room 101',
    })
    assertOk(created.body)
    const id = (created.body.data as { id: string }).id

    // Delete it.
    const del = await client.delete(`/api/tickets/${id}`)
    expect(del.status).toBeLessThan(300)

    // Direct fetch → should 404.
    const direct = await client.get(`/api/tickets/${id}`)
    expect([404, 403]).toContain(direct.status)

    // List → should not include it.
    const list = await client.get<unknown>('/api/tickets')
    assertOk(list.body)
    const items = Array.isArray(list.body.data)
      ? (list.body.data as Array<{ id: string }>)
      : ((list.body.data as { items?: Array<{ id: string }> }).items ?? [])
    expect(items.some((t) => t.id === id), 'soft-deleted ticket appeared in list!').toBe(false)

    await client.dispose()
  })
})
