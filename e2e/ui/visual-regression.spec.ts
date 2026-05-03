import { test, expect } from '../fixtures'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Visual Regression Sweep
 * =======================
 * Takes a full-page screenshot of every crawlable page and compares it against
 * a stored baseline. Fails if pixels diverge beyond a small threshold.
 *
 * First run: passes and writes the baselines into:
 *   e2e/ui/visual-regression.spec.ts-snapshots/
 *
 * Subsequent runs: compare against those baselines. To accept a new look on
 * purpose, run with `--update-snapshots`:
 *   npm run test:e2e:visual:update
 *
 * Configurable via env:
 *   E2E_VISUAL_MAX_PAGES — pages to screenshot (default 25, max 60)
 *   E2E_VISUAL_THRESHOLD — pixel difference tolerance (0.0–1.0, default 0.02)
 *
 * Why not Storybook + Chromatic?
 *   For a multi-tenant SaaS, "did the *page* break" is the higher-stakes
 *   regression. Component-level isolation (Storybook) is a separate, larger
 *   effort tracked in the Week 3 follow-up.
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}

const MAX_PAGES = Math.min(Number(process.env.E2E_VISUAL_MAX_PAGES ?? '25'), 60)
const THRESHOLD = Math.min(Math.max(Number(process.env.E2E_VISUAL_THRESHOLD ?? '0.02'), 0), 1)
const ROUTES = inventory.crawlable.slice(0, MAX_PAGES)

/**
 * Anti-flake stylesheet — disables animations, transitions, and caret blink
 * that would otherwise produce noisy diffs. Applied per-test, never persists.
 */
const STABLE_VIEWPORT_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  /* Hide skeleton/animated loaders that finish on their own schedule */
  .animate-pulse, [class*='animate-spin'] { animation: none !important; opacity: 0 !important; }
`

for (const route of ROUTES) {
  const safeName = route.replace(/^\//, '').replace(/\//g, '-') || 'root'

  test(`visual: ${safeName} (${route})`, async ({ adminPage }) => {
    const res = await adminPage.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null)
    if (!res) test.skip(true, `Route ${route} not reachable`)
    expect(res!.status(), `${route} returned ${res!.status()}`).toBeLessThan(500)

    // Wait for data to settle. networkidle is a reasonable proxy for "the
    // page has stopped changing" on TanStack Query apps.
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Inject anti-flake CSS so animations and skeletons don't produce noisy
    // pixel diffs.
    await adminPage.addStyleTag({ content: STABLE_VIEWPORT_CSS })

    // Tiny extra settle for fonts.
    await adminPage.waitForTimeout(300)

    await expect(adminPage).toHaveScreenshot(`${safeName}.png`, {
      fullPage: true,
      // `maxDiffPixelRatio` is fraction of total pixels allowed to differ.
      maxDiffPixelRatio: THRESHOLD,
      // Mask elements that legitimately vary run-to-run (timestamps, charts).
      mask: [
        adminPage.locator('[data-test-flaky="true"]'),
        adminPage.locator('time, .timestamp, [data-timestamp]'),
      ],
    })
  })
}
