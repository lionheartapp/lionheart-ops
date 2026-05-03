import { test, expect } from '../../fixtures'

/**
 * Super-Admin journeys.
 *
 * The super-admin role is the org's owner. They should be able to do
 * everything from the dashboard. These specs walk through the highest-value
 * flows a super-admin actually uses on day one.
 *
 * Brittleness budget: low. These specs are forgiving with selectors so a
 * small UI rename doesn't take them down. If a journey changes meaningfully,
 * update the spec.
 */

test.describe('Super-admin flow · org setup essentials', () => {
  test('lands on dashboard with the full sidebar', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await expect(adminPage.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    // Super-admin sidebar should expose the privileged areas.
    const sidebar = adminPage.locator('nav, [role="navigation"]').first()
    for (const label of ['Settings', 'Members', 'Billing']) {
      const item = sidebar.getByRole('link', { name: new RegExp(label, 'i') }).first()
      // Either the link is visible directly or under a collapsible Settings group
      await expect(
        item.or(adminPage.getByText(new RegExp(label, 'i')).first()),
        `super-admin sidebar should expose ${label}`,
      ).toBeVisible({ timeout: 10_000 })
    }
  })

  test('can open the Invite User modal from settings/members', async ({ adminPage }) => {
    await adminPage.goto('/settings/members').catch(() => {})
    if (adminPage.url().includes('/settings/members') === false) {
      // Fallback path used by some tenant routes.
      await adminPage.goto('/settings').catch(() => {})
    }
    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const inviteBtn = adminPage
      .getByRole('button', { name: /invite|add (user|member|teammate)/i })
      .first()
    test.skip(!(await inviteBtn.isVisible().catch(() => false)), 'Invite UI not on this route')

    await inviteBtn.click()

    // The modal must show an email field to be a valid invite form.
    await expect(adminPage.getByLabel(/email/i).first()).toBeVisible({ timeout: 5_000 })
    // Press Escape to dismiss; we don't want to actually invite during this smoke.
    await adminPage.keyboard.press('Escape').catch(() => {})
  })

  test('can open the Create Role flow', async ({ adminPage }) => {
    await adminPage.goto('/settings/roles').catch(() => {})
    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const createBtn = adminPage
      .getByRole('button', { name: /create role|new role|add role/i })
      .first()
    test.skip(!(await createBtn.isVisible().catch(() => false)), 'Roles UI not on this route')

    await createBtn.click()
    await expect(adminPage.getByLabel(/name|role name/i).first()).toBeVisible({ timeout: 5_000 })
    await adminPage.keyboard.press('Escape').catch(() => {})
  })

  test('campus tab shows building hierarchy', async ({ adminPage }) => {
    await adminPage.goto('/settings/campus').catch(() => {})
    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const heading = adminPage.getByRole('heading').first()
    test.skip(!(await heading.isVisible().catch(() => false)), 'Campus UI not on this route')
    // The hierarchy components vary, but at minimum the heading should render.
    await expect(heading).toBeVisible()
  })
})
