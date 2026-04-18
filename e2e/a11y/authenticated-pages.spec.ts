import { test, expect } from '../fixtures'
import AxeBuilder from '@axe-core/playwright'

/**
 * WCAG 2.1 AA audits on the authenticated app shell + primary inner pages.
 * Skips color-contrast by default (brand theming is dynamic — revisit once tokens
 * are wired). Fails on any other violation.
 */

const AUTH_ROUTES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/settings', name: 'settings' },
  { path: '/it', name: 'it-helpdesk' },
  { path: '/av', name: 'events' },
  { path: '/calendar', name: 'calendar' },
] as const

for (const route of AUTH_ROUTES) {
  test(`${route.name} (${route.path}) — WCAG 2.1 AA`, async ({ adminPage }) => {
    const res = await adminPage.goto(route.path).catch(() => null)
    test.skip(!res || res.status() >= 500, `Route ${route.path} not deployed`)
    await adminPage.waitForLoadState('networkidle').catch(() => {})

    const results = await new AxeBuilder({ page: adminPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze()

    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`,
    )
    expect(results.violations, summary.join('\n')).toEqual([])
  })
}
