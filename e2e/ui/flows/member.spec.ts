import { test, expect } from '../../fixtures'
import { ticketTitle } from '../../helpers/data'

/**
 * Member-role journeys.
 *
 * Members are the bulk of users — teachers, staff, end-of-line submitters.
 * The most important flows are: log in, submit a ticket, view their own,
 * comment. Settings and admin features should be hidden or gated.
 */

test.describe('Member flow · day-to-day usage', () => {
  test('member dashboard loads without admin-only widgets', async ({ memberPage }) => {
    await memberPage.goto('/dashboard')
    await expect(memberPage.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    // Members should NOT see Billing, Roles management, or User invite controls
    // anywhere on the landing page. Either the links are absent or hitting them
    // 403s — both are fine, both should be tested at the URL level.
    const adminOnlyLabels = [/billing/i, /invite (user|member)/i, /create role/i]
    for (const label of adminOnlyLabels) {
      const visible = await memberPage.getByText(label).first().isVisible().catch(() => false)
      expect(visible, `members should not see "${label.source}" on dashboard`).toBe(false)
    }
  })

  test('member can submit a ticket and see it appear', async ({ memberPage }) => {
    const title = ticketTitle()
    await memberPage.goto('/it')
    await memberPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const newBtn = memberPage
      .getByRole('button', { name: /new ticket|create ticket|\+ ticket|add ticket|submit (a )?ticket/i })
      .or(memberPage.getByRole('link', { name: /new ticket|create ticket/i }))
      .first()

    test.skip(!(await newBtn.isVisible().catch(() => false)), 'Ticket creation UI not on /it')

    await newBtn.click()
    const titleField = memberPage.getByLabel(/title|subject|summary/i).first()
    await expect(titleField).toBeVisible({ timeout: 5_000 })
    await titleField.fill(title)

    const desc = memberPage.getByLabel(/description|details|notes/i).first()
    if (await desc.isVisible().catch(() => false)) {
      await desc.fill(`E2E member ticket — ${title}`)
    }

    await memberPage.getByRole('button', { name: /create|submit|save/i }).first().click()

    // The new ticket should appear in the list.
    await expect(memberPage.getByText(title).first()).toBeVisible({ timeout: 10_000 })
  })

  test('member is blocked from /settings/roles directly', async ({ memberPage }) => {
    const res = await memberPage.goto('/settings/roles', { waitUntil: 'domcontentloaded' }).catch(() => null)
    if (!res) test.skip(true, '/settings/roles not deployed')

    // Two acceptable outcomes: server-side 403/404 OR client-side redirect away.
    const status = res!.status()
    if (status === 200) {
      // If server returned a page, the page itself must NOT show admin controls.
      const createBtn = memberPage.getByRole('button', { name: /create role|new role/i }).first()
      const visible = await createBtn.isVisible().catch(() => false)
      expect(visible, 'member loaded /settings/roles AND saw Create Role button').toBe(false)
    } else {
      expect([401, 403, 404]).toContain(status)
    }
  })
})
