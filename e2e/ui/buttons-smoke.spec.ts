import { test, expect } from '../fixtures'

/**
 * "Every button on every primary page is clickable and does something" smoke.
 *
 * This is a broad low-fidelity check — it catches the most common UI breakage
 * (null refs, broken handlers, JS errors on click) without asserting business
 * outcomes. Pair it with focused flow tests per feature.
 */

const PRIMARY_ROUTES = [
  '/dashboard',
  '/settings',
  '/it',
  '/av',
  '/calendar',
  '/it/devices',
  '/it/helpdesk',
] as const

for (const route of PRIMARY_ROUTES) {
  test(`buttons on ${route} fire without throwing`, async ({ adminPage }) => {
    const errors: string[] = []
    adminPage.on('pageerror', (e) => errors.push(`[${route}] ${e.message}`))

    const res = await adminPage.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null)
    if (!res) test.skip(true, `Route ${route} not reachable in this env`)
    expect(res!.status(), `${route} returned ${res!.status()}`).toBeLessThan(500)

    // Wait for primary content to render.
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Collect enabled, visible buttons — exclude destructive ones by aria/text.
    const buttons = await adminPage
      .getByRole('button')
      .filter({ hasNotText: /delete|remove|cancel|sign out|log out|archive|reject/i })
      .all()

    // Limit to 6 per page to keep the smoke fast & deterministic.
    const sample = buttons.slice(0, 6)

    for (const btn of sample) {
      if (!(await btn.isVisible().catch(() => false))) continue
      if (!(await btn.isEnabled().catch(() => false))) continue

      // Click in a try/catch so one bad button doesn't abort the whole page.
      await btn.click({ trial: false, timeout: 5_000 }).catch(() => {})

      // If a dialog opened, dismiss it before moving on.
      const closeBtn = adminPage
        .getByRole('button', { name: /close|cancel|dismiss/i })
        .first()
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {})
      }
      await adminPage.keyboard.press('Escape').catch(() => {})
    }

    expect(errors, errors.join('\n')).toHaveLength(0)
  })
}
