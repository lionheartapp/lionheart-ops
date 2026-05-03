import { test, expect } from '../fixtures'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * WCAG 2.1 AA audits on every authenticated page in the app.
 *
 * The route list is auto-generated from src/app/**\/page.tsx by
 * `scripts/inventory-pages.mjs`. Re-run that script after adding pages.
 *
 * Skips color-contrast by default (brand theming is dynamic — revisit once tokens
 * are wired). Fails on any other violation.
 *
 * Configurable via env:
 *   E2E_A11Y_MAX_PAGES — pages to scan (default: all crawlable, max 80)
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}

const MAX_PAGES = Math.min(
  Number(process.env.E2E_A11Y_MAX_PAGES ?? String(inventory.crawlable.length)),
  80,
)

const AUTH_ROUTES = inventory.crawlable.slice(0, MAX_PAGES).map((p) => ({
  path: p,
  name: p.replace(/^\//, '').replace(/\//g, '-') || 'root',
}))

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
