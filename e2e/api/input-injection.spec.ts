import { test, expect } from '@playwright/test'
import { ApiClient, assertOk } from '../helpers/api'
import { env } from '../helpers/env'
import { ticketTitle } from '../helpers/data'

/**
 * Input injection tests — verify XSS, SQL injection, and boundary payloads
 * are handled safely. The app uses:
 *   - Zod validation at every API boundary
 *   - stripAllHtml() transform on plain-text fields (title, locationText)
 *   - sanitizeHtml() on rich-text fields (description)
 *   - Prisma parameterized queries (no raw SQL in search paths)
 *
 * These tests confirm those defenses work end-to-end.
 */

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg/onload=alert(1)>',
  "javascript:alert('xss')",
  '<iframe src="javascript:alert(1)"></iframe>',
  '<div onmouseover="alert(1)">hover me</div>',
]

const SQL_PAYLOADS = [
  "'; DROP TABLE tickets; --",
  "' OR '1'='1",
  '1; SELECT * FROM "User"',
  "' UNION SELECT email, passwordHash FROM \"User\" --",
  "Robert'); DROP TABLE tickets;--",
]

test.describe('Input injection · XSS in ticket title', () => {
  let client: ApiClient
  const createdIds: string[] = []

  test.beforeAll(async () => {
    client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
  })

  test.afterAll(async () => {
    // Cleanup all test tickets
    for (const id of createdIds) {
      await client.delete(`/api/tickets/${id}`).catch(() => {})
    }
    await client.dispose()
  })

  for (const payload of XSS_PAYLOADS) {
    test(`title with "${payload.slice(0, 30)}..." is stripped or rejected`, async () => {
      const prefix = ticketTitle()
      const created = await client.post<{ id: string; title: string }>('/api/tickets', {
        title: `${prefix} ${payload}`,
        description: 'XSS test',
        priority: 'LOW',
        category: 'IT',
        locationText: 'Room 101',
      })

      if (created.status >= 400) {
        // Rejected outright — that's fine.
        return
      }

      assertOk(created.body)
      const data = created.body.data as { id: string; title: string }
      createdIds.push(data.id)

      // The title should NOT contain the raw XSS payload.
      // stripAllHtml removes all tags, so <script>, <img>, etc. should be gone.
      expect(data.title).not.toContain('<script')
      expect(data.title).not.toContain('onerror=')
      expect(data.title).not.toContain('onload=')
      expect(data.title).not.toContain('onmouseover=')
      expect(data.title).not.toContain('<iframe')
      expect(data.title).not.toContain('<svg')

      // Verify via GET too — in case the POST response differs from stored data.
      const fetched = await client.get<{ title: string }>(`/api/tickets/${data.id}`)
      assertOk(fetched.body)
      const storedTitle = (fetched.body.data as { title: string }).title
      expect(storedTitle).not.toContain('<script')
      expect(storedTitle).not.toContain('onerror=')
    })
  }
})

test.describe('Input injection · XSS in description', () => {
  let client: ApiClient

  test.beforeAll(async () => {
    client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
  })

  test.afterAll(async () => {
    await client.dispose()
  })

  test('script tags in description are stripped', async () => {
    const title = ticketTitle()
    const created = await client.post<{ id: string; description: string }>('/api/tickets', {
      title,
      description: 'Normal text <script>alert("xss")</script> more text <img src=x onerror=alert(1)>',
      priority: 'LOW',
      category: 'IT',
      locationText: 'Room 101',
    })

    if (created.status >= 400) return // Rejected — fine

    assertOk(created.body)
    const data = created.body.data as { id: string; description: string }
    expect(data.description).not.toContain('<script')
    expect(data.description).not.toContain('onerror=')

    // Cleanup
    await client.delete(`/api/tickets/${data.id}`)
  })
})

test.describe('Input injection · SQL injection in search', () => {
  let client: ApiClient

  test.beforeAll(async () => {
    client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
  })

  test.afterAll(async () => {
    await client.dispose()
  })

  for (const payload of SQL_PAYLOADS) {
    test(`search with "${payload.slice(0, 30)}..." does not crash or leak`, async () => {
      const res = await client.get<unknown>(
        `/api/tickets?search=${encodeURIComponent(payload)}`,
      )

      // Should either succeed (empty results) or return a validation error.
      // Must NOT return 500 (crash) or leak data from other tables.
      expect(res.status, `SQL payload crashed the server: ${payload}`).toBeLessThan(500)

      if (res.status < 300) {
        assertOk(res.body)
        // The results should only contain tickets from this org, not leaked data.
        const items = Array.isArray(res.body.data)
          ? (res.body.data as Array<{ id: string }>)
          : ((res.body.data as { items?: Array<{ id: string }> }).items ?? [])
        // Sanity: we don't expect SQL injection to return the entire user table.
        // If somehow hundreds of results come back, that's suspicious.
        expect(items.length, 'Suspiciously many results from SQL injection payload').toBeLessThan(500)
      }
    })
  }
})

test.describe('Input injection · boundary payloads', () => {
  let client: ApiClient

  test.beforeAll(async () => {
    client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
  })

  test.afterAll(async () => {
    await client.dispose()
  })

  test('title over 200 chars is rejected', async () => {
    const res = await client.post('/api/tickets', {
      title: 'A'.repeat(201),
      description: 'Too long title test',
      priority: 'LOW',
      category: 'IT',
      locationText: 'Room 101',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  test('empty title is rejected', async () => {
    const res = await client.post('/api/tickets', {
      title: '',
      description: 'Empty title test',
      priority: 'LOW',
      category: 'IT',
      locationText: 'Room 101',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  test('null bytes in title are handled safely', async () => {
    const title = ticketTitle()
    const res = await client.post('/api/tickets', {
      title: `${title}\x00injected`,
      description: 'Null byte test',
      priority: 'LOW',
      category: 'IT',
      locationText: 'Room 101',
    })
    // Should either reject or strip the null byte — not crash.
    expect(res.status).toBeLessThan(500)
    if (res.status < 300 && res.body.ok) {
      const data = res.body.data as { id: string; title: string }
      // Cleanup
      await client.delete(`/api/tickets/${data.id}`)
    }
  })

  test('invalid category enum is rejected', async () => {
    const res = await client.post('/api/tickets', {
      title: ticketTitle(),
      description: 'Bad enum test',
      priority: 'LOW',
      category: 'NONEXISTENT_CATEGORY',
      locationText: 'Room 101',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  test('invalid priority enum is rejected', async () => {
    const res = await client.post('/api/tickets', {
      title: ticketTitle(),
      description: 'Bad priority test',
      priority: 'SUPER_MEGA_URGENT',
      category: 'IT',
      locationText: 'Room 101',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})
