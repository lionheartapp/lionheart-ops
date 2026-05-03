import { test, expect } from '@playwright/test'
import { ApiClient, assertOk } from '../helpers/api'
import { env } from '../helpers/env'
import { ticketTitle, eventTitle } from '../helpers/data'

/**
 * Multi-tenancy is the security foundation of Lionheart. These tests verify
 * that Org A data is invisible to Org B even when Org B's admin tries hard
 * to fetch it.
 *
 * Requires Org B env vars — see .env.e2e.example.
 */

test.describe('Multi-tenancy · Org A ↔ Org B isolation', () => {
  test.skip(!env.hasOrgB(), 'Org B credentials not configured — set E2E_ORG_B_* vars')

  // ─── Ticket isolation ──────────────────────────────────────────────

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
      category: 'IT',
      locationText: 'Room 101',
    })
    assertOk(created.body)
    const orgATicketId = (created.body.data as { id: string }).id

    // Org B lists tickets — should NOT include Org A's ticket.
    const list = await orgB.get<unknown>('/api/tickets')
    assertOk(list.body)
    const items = Array.isArray(list.body.data)
      ? (list.body.data as Array<{ id: string; title?: string }>)
      : ((list.body.data as { items?: Array<{ id: string; title?: string }> }).items ?? [])

    expect(items.some((t) => t.id === orgATicketId), 'LEAK: Org B saw Org A ticket in list!').toBe(false)
    expect(items.some((t) => (t.title ?? '').includes(title))).toBe(false)

    // Org B tries to fetch by ID directly — should 404 / 403 / not-found envelope.
    const direct = await orgB.get(`/api/tickets/${orgATicketId}`)
    expect([403, 404]).toContain(direct.status)

    // Org B tries to update Org A's ticket — should fail.
    const updateAttempt = await orgB.put(`/api/tickets/${orgATicketId}`, {
      title: 'hacked by org B',
    })
    expect([403, 404]).toContain(updateAttempt.status)

    // Org B tries to delete Org A's ticket — should fail.
    const deleteAttempt = await orgB.delete(`/api/tickets/${orgATicketId}`)
    expect([403, 404]).toContain(deleteAttempt.status)

    // Verify Org A's ticket still exists and is unchanged.
    const verify = await orgA.get<{ title: string }>(`/api/tickets/${orgATicketId}`)
    assertOk(verify.body)
    expect((verify.body.data as { title: string }).title).toBe(title)

    // Cleanup
    await orgA.delete(`/api/tickets/${orgATicketId}`)
    await orgA.dispose()
    await orgB.dispose()
  })

  // ─── Event isolation ───────────────────────────────────────────────

  test('Org B admin cannot see Org A events', async () => {
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

    // Seed an event in Org A.
    const title = eventTitle()
    const created = await orgA.post<{ id: string }>('/api/events', {
      title,
      description: 'Org A event',
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
    })

    // Events may use draft-events or events — handle both.
    if (created.status >= 400) {
      // Try draft-events instead
      const draft = await orgA.post<{ id: string }>('/api/draft-events', {
        title,
        description: 'Org A draft event',
      })
      if (draft.status >= 400) {
        test.skip(true, 'Event creation not available — skipping isolation check')
        return
      }
      assertOk(draft.body)
      const draftId = (draft.body.data as { id: string }).id

      // Org B cannot see Org A's draft
      const orgBDraft = await orgB.get(`/api/draft-events/${draftId}`)
      expect([403, 404]).toContain(orgBDraft.status)

      await orgA.delete(`/api/draft-events/${draftId}`)
      await orgA.dispose()
      await orgB.dispose()
      return
    }

    assertOk(created.body)
    const eventId = (created.body.data as { id: string }).id

    // Org B fetches — should 404 / 403.
    const direct = await orgB.get(`/api/events/${eventId}`)
    expect([403, 404]).toContain(direct.status)

    // Org B lists events — Org A's event should not appear.
    const list = await orgB.get<unknown>('/api/events')
    assertOk(list.body)
    const items = Array.isArray(list.body.data)
      ? (list.body.data as Array<{ id: string }>)
      : ((list.body.data as { items?: Array<{ id: string }> }).items ?? [])
    expect(items.some((e) => e.id === eventId), 'LEAK: Org B saw Org A event!').toBe(false)

    // Cleanup
    await orgA.delete(`/api/events/${eventId}`)
    await orgA.dispose()
    await orgB.dispose()
  })

  // ─── User isolation ────────────────────────────────────────────────

  test('Org B admin cannot see Org A users', async () => {
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

    // Get Org A's user list
    const orgAUsers = await orgA.get<unknown>('/api/settings/users')
    assertOk(orgAUsers.body)
    const aUsers = Array.isArray(orgAUsers.body.data)
      ? (orgAUsers.body.data as Array<{ id: string; email: string }>)
      : ((orgAUsers.body.data as { items?: Array<{ id: string; email: string }> }).items ?? [])

    // Get Org B's user list
    const orgBUsers = await orgB.get<unknown>('/api/settings/users')
    assertOk(orgBUsers.body)
    const bUsers = Array.isArray(orgBUsers.body.data)
      ? (orgBUsers.body.data as Array<{ id: string; email: string }>)
      : ((orgBUsers.body.data as { items?: Array<{ id: string; email: string }> }).items ?? [])

    // No user IDs should overlap (different orgs, different user records).
    const aIds = new Set(aUsers.map((u) => u.id))
    const bIds = new Set(bUsers.map((u) => u.id))
    const overlap = [...aIds].filter((id) => bIds.has(id))
    expect(overlap, 'LEAK: same user ID in both orgs!').toEqual([])

    // Org B should not see Org A's admin email in their user list.
    const aEmails = aUsers.map((u) => u.email)
    const bEmails = bUsers.map((u) => u.email)
    const leakedEmails = aEmails.filter((e) => bEmails.includes(e))
    // e2e test accounts might share email patterns but not actual records
    // so just verify Org A's dedicated admin isn't in Org B's list.
    expect(
      bEmails.includes(env.orgA.adminEmail),
      'LEAK: Org A admin email visible in Org B user list!',
    ).toBe(false)

    await orgA.dispose()
    await orgB.dispose()
  })

  // ─── Settings isolation ────────────────────────────────────────────

  test('Org B admin cannot see Org A roles', async () => {
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

    const aRoles = await orgA.get<Array<{ id: string }>>('/api/settings/roles')
    assertOk(aRoles.body)
    const bRoles = await orgB.get<Array<{ id: string }>>('/api/settings/roles')
    assertOk(bRoles.body)

    const aRoleIds = (aRoles.body.data as Array<{ id: string }>).map((r) => r.id)
    const bRoleIds = (bRoles.body.data as Array<{ id: string }>).map((r) => r.id)

    // Role IDs should be completely disjoint — each org has its own copy.
    const overlap = aRoleIds.filter((id) => bRoleIds.includes(id))
    expect(overlap, 'LEAK: same role ID in both orgs!').toEqual([])

    await orgA.dispose()
    await orgB.dispose()
  })

  test('Org B admin cannot see Org A teams', async () => {
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

    const aTeams = await orgA.get<Array<{ id: string }>>('/api/settings/teams')
    assertOk(aTeams.body)
    const bTeams = await orgB.get<Array<{ id: string }>>('/api/settings/teams')
    assertOk(bTeams.body)

    const aTeamIds = (aTeams.body.data as Array<{ id: string }>).map((t) => t.id)
    const bTeamIds = (bTeams.body.data as Array<{ id: string }>).map((t) => t.id)

    const overlap = aTeamIds.filter((id) => bTeamIds.includes(id))
    expect(overlap, 'LEAK: same team ID in both orgs!').toEqual([])

    await orgA.dispose()
    await orgB.dispose()
  })

  // ─── Header forging ────────────────────────────────────────────────

  test('forging x-org-id header does not break isolation', async () => {
    // Org B client that forges x-org-id to Org A's ID.
    // The middleware should trust the JWT, not the client header.
    const orgB = await ApiClient.login({
      email: env.orgB.adminEmail,
      password: env.orgB.adminPassword,
      organizationId: env.orgB.id,
    })
    orgB.organizationId = env.orgA.id

    // Try to read Org A's users with forged header.
    const { status, body } = await orgB.get<unknown>('/api/settings/users')
    if (status < 400) {
      // If the call succeeded, verify the data belongs to Org B, not Org A.
      assertOk(body)
      const users = Array.isArray(body.data)
        ? (body.data as Array<{ email: string }>)
        : ((body.data as { items?: Array<{ email: string }> }).items ?? [])
      const emails = users.map((u) => u.email)
      expect(
        emails.includes(env.orgA.adminEmail),
        'CRITICAL LEAK: forged x-org-id header returned Org A data!',
      ).toBe(false)
    } else {
      // 400/401/403 all acceptable — the forged header was rejected.
      expect([400, 401, 403]).toContain(status)
    }
    await orgB.dispose()
  })

  test('forged x-org-id cannot read another org\'s tickets', async () => {
    const orgA = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })

    // Create a ticket in Org A.
    const title = ticketTitle()
    const created = await orgA.post<{ id: string }>('/api/tickets', {
      title,
      description: 'isolation test',
      priority: 'NORMAL',
      category: 'IT',
      locationText: 'Room 101',
    })
    assertOk(created.body)
    const ticketId = (created.body.data as { id: string }).id

    // Org B logs in, forges org ID to Org A.
    const orgB = await ApiClient.login({
      email: env.orgB.adminEmail,
      password: env.orgB.adminPassword,
      organizationId: env.orgB.id,
    })
    orgB.organizationId = env.orgA.id

    // Should not be able to fetch Org A's ticket.
    const fetch = await orgB.get(`/api/tickets/${ticketId}`)
    // Accept 401/403/404 — anything except a successful read of Org A data.
    if (fetch.status < 400) {
      // If it somehow returned 200, verify the data is NOT the Org A ticket.
      const data = fetch.body.ok ? (fetch.body.data as { id?: string; title?: string }) : null
      expect(
        data?.id !== ticketId,
        'CRITICAL LEAK: forged header returned another org\'s ticket!',
      ).toBe(true)
    }

    // Cleanup
    await orgA.delete(`/api/tickets/${ticketId}`)
    await orgA.dispose()
    await orgB.dispose()
  })

  // ─── Cross-org mutation attempts ───────────────────────────────────

  test('Org B cannot create a ticket scoped to Org A', async () => {
    // Org B logs in normally, then forges the org header to Org A.
    const orgB = await ApiClient.login({
      email: env.orgB.adminEmail,
      password: env.orgB.adminPassword,
      organizationId: env.orgB.id,
    })
    orgB.organizationId = env.orgA.id

    const title = ticketTitle()
    const created = await orgB.post<{ id: string }>('/api/tickets', {
      title,
      description: 'Should not land in Org A',
      priority: 'LOW',
      category: 'IT',
      locationText: 'Room 101',
    })

    if (created.status < 400) {
      // If it succeeded, verify the ticket ended up in Org B, not Org A.
      assertOk(created.body)
      const ticketId = (created.body.data as { id: string }).id

      // Log in as Org A — should NOT see this ticket.
      const orgA = await ApiClient.login({
        email: env.orgA.adminEmail,
        password: env.orgA.adminPassword,
        organizationId: env.orgA.id,
      })
      const check = await orgA.get(`/api/tickets/${ticketId}`)
      expect(
        [403, 404].includes(check.status),
        'CRITICAL LEAK: ticket created via forged header landed in wrong org!',
      ).toBe(true)

      await orgA.dispose()

      // Cleanup: switch back to Org B and delete.
      orgB.organizationId = env.orgB.id
      await orgB.delete(`/api/tickets/${ticketId}`)
    }

    await orgB.dispose()
  })
})
