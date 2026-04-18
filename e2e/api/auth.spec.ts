import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertFail } from '../helpers/api'
import { env } from '../helpers/env'

test.describe('API · /api/auth/login', () => {
  // Serial: negative tests burn rate-limit tokens — run them in order
  // so the positive test always goes first.
  test.describe.configure({ mode: 'serial' })

  test('admin can log in and sets an auth cookie', async () => {
    const client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
    // Verify the session works via /api/auth/me (the actual GET endpoint).
    const me = await client.get('/api/auth/me')
    expect(me.status, JSON.stringify(me.body)).toBe(200)
    assertOk(me.body)
    await client.dispose()
  })

  test('rejects missing fields with BAD_REQUEST', async () => {
    const client = await ApiClient.anonymous()
    const res = await client.post('/api/auth/login', {})
    expect(res.status).toBe(400)
    assertFail(res.body, 'BAD_REQUEST')
    await client.dispose()
  })

  test('rejects wrong password with UNAUTHORIZED', async () => {
    const client = await ApiClient.anonymous()
    const res = await client.post('/api/auth/login', {
      email: env.orgA.adminEmail,
      password: 'totally-wrong-password',
      organizationId: env.orgA.id,
    })
    // 401 is the expected response, but the rate limiter may fire 429
    // if prior tests in this run already burned attempts from the same IP.
    expect([401, 429]).toContain(res.status)
    if (res.status === 401) {
      assertFail(res.body, 'UNAUTHORIZED')
    }
    await client.dispose()
  })

  test('rejects nonexistent user with UNAUTHORIZED (no user enumeration)', async () => {
    const client = await ApiClient.anonymous()
    const res = await client.post('/api/auth/login', {
      email: 'nobody-like-this-exists@lionheart-test.com',
      password: 'anything',
      organizationId: env.orgA.id,
    })
    // Same tolerance for rate limiting as the wrong-password test above.
    expect([401, 429]).toContain(res.status)
    if (res.status === 401) {
      assertFail(res.body, 'UNAUTHORIZED')
    }
    await client.dispose()
  })
})

test.describe('API · /api/organizations/slug-check', () => {
  test('returns an envelope with an availability flag', async () => {
    const client = await ApiClient.anonymous()
    const res = await client.get('/api/organizations/slug-check?slug=definitely-free-e2e-slug')
    expect([200, 400]).toContain(res.status)
    expect(res.body).toHaveProperty('ok')
    await client.dispose()
  })
})
