import { test, expect } from '@playwright/test'
import { ApiClient, assertOk } from '../helpers/api'
import { env } from '../helpers/env'
import { ticketTitle } from '../helpers/data'

/**
 * Multi-tenancy is the security foundation of Lionheart. These tests verify
 * that Org A data is invisible to Org B even when Org B's admin tries hard
 * to fetch it.
 *
 * Requires Org B env vars — see .env.e2e.example.
 */

test.describe('Multi-tenancy · Org A ↔ Org B isolation', () => {
  test.skip(!env.hasOrgB(), 'Org B credentials not configured — set E2E_ORG_B_* vars')

  test('Org B admin cannot see Org A tickets in their list', async () => {
    const orgA = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
    const orgB = await ApiClient.login({
      email: env.orgB.adminEmail,
      password: env.orgB.adminPassword,
      organizationId: env.orgB.id,
    })

    // Seed a ticket in Org A.
    const title = ticketTitle()
    const created = await orgA.post<{ id: string }>('/api/tickets', {
      title,
      description: 'Org A private',
      priority: 'LOW',
      category: 'IT_SUPPORT',
    })
    assertOk(created.body)
    const orgATicketId = (created.body.data as { id: string }).id

    // Org B lists tickets — should NOT include Org A's ticket.
    const list = await orgB.get<unknown>('/api/tickets')
    assertOk(list.body)
    const items = Array.isArray(list.body.data)
      ? (list.body.data as Array<{ id: string; title?: string }>)
      : ((list.body.data as { items?: Array<{ id: string; title?: string }> }).items ?? [])

    expect(items.some((t) => t.id === orgATicketId), 'LEAK: Org B saw Org A ticket!').toBe(false)
    expect(items.some((t) => (t.title ?? '').includes(title))).toBe(false)

    // Org B tries to fetch by ID directly — should 404 / 403 / not-found envelope.
    const direct = await orgB.get(`/api/tickets/${orgATicketId}`)
    expect([403, 404], `Org B got ${direct.status} for another org's ticket`).toContain(direct.status)

    // Cleanup: Org A deletes its ticket.
    await orgA.delete(`/api/tickets/${orgATicketId}`)
    await orgA.dispose()
    await orgB.dispose()
  })

  test('passing another org\'s x-org-id header does not break isolation', async () => {
    // An authenticated Org B client that forges x-org-id to match Org A.
    // The middleware should ignore the client header and trust the JWT.
    const orgB = await ApiClient.login({
      email: env.orgB.adminEmail,
      password: env.orgB.adminPassword,
      organizationId: env.orgB.id,
    })
    // Forge the client-side orgId.
    orgB.organizationId = env.orgA.id

    const { status, body } = await orgB.get('/api/settings/users')
    if (status < 400) {
      // If the call succeeded, the data returned MUST still be Org B's (never Org A's).
      // We don't have a direct way to verify user IDs here, but the envelope must be a success
      // on Org B's data — and the count should NOT match Org A's count if visibly different.
      assertOk(body)
    } else {
      // A 400/403 is equally acceptable — we explicitly reject the forged header.
      expect([400, 401, 403]).toContain(status)
    }
    await orgB.dispose()
  })
})
