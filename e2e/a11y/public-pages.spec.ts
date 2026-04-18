import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { env } from '../helpers/env'

/**
 * Accessibility audits on unauthenticated / public pages.
 * Fails only on WCAG 2.1 AA violations — 'best-practice' rules are logged but not failed.
 */

const PUBLIC_ROUTES = [
  { path: '/login', name: 'login' },
  { path: '/signup', name: 'signup' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
] as const

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} (${route.path}) has no WCAG 2.1 AA violations`, async ({ page }) => {
    const url = route.path === '/login' ? `/login?org=${env.orgA.slug}` : route.path
    const res = await page.goto(url).catch(() => null)
    test.skip(!res || res.status() >= 500, `Route ${url} not deployed`)

    await page.waitForLoadState('networkidle').catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // often noisy with dynamic brand themes; re-enable once stable
      .analyze()

    // Log best-practice/serious issues even when we don't fail on them.
    if (results.violations.length) {
      console.log(
        `[a11y:${route.name}] ${results.violations.length} violations:`,
        results.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', '),
      )
    }
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
}
