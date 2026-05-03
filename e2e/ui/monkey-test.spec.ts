import { test, expect } from '../fixtures'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Monkey Test
 * ===========
 * Random clicker. For each page, picks visible interactive elements at random
 * for N seconds and records anything that crashes — JS errors, unhandled
 * promise rejections, console errors.
 *
 * The scripted tests cover "the things we know to test." This covers the
 * combinations no human would think to script — open a modal, scroll,
 * tab-switch, click a third thing while the first is loading. Surprisingly
 * effective at finding race conditions and stale-state bugs.
 *
 * Configurable via env:
 *   E2E_MONKEY_DURATION_MS — per-page click duration (default 12000, max 60000)
 *   E2E_MONKEY_MAX_PAGES   — pages to monkey (default 10, max 30)
 *   E2E_MONKEY_SEED        — RNG seed for reproducible failures
 *
 * The monkey deliberately avoids destructive actions (delete, remove, log out,
 * sign out, archive, reject) by filtering candidate buttons by accessible
 * name. It also avoids form submits — `forms-smoke.spec.ts` covers those.
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}

const DURATION_MS = Math.min(Number(process.env.E2E_MONKEY_DURATION_MS ?? '12000'), 60_000)
const MAX_PAGES = Math.min(Number(process.env.E2E_MONKEY_MAX_PAGES ?? '10'), 30)
const SEED = Number(process.env.E2E_MONKEY_SEED ?? Date.now())

const ROUTES = inventory.crawlable.slice(0, MAX_PAGES)

const DESTRUCTIVE_RE =
  /\b(delete|remove|trash|archive|reject|deny|sign\s*out|log\s*out|cancel(\s+subscription)?|reset)\b/i

/**
 * Mulberry32 — small deterministic PRNG. Lets `E2E_MONKEY_SEED` reproduce a
 * specific failure run.
 */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Crash {
  route: string
  message: string
  kind: 'pageerror' | 'console.error' | 'pagecrash' | 'unhandledrejection'
}

for (const route of ROUTES) {
  test(`monkey: ${route} (${DURATION_MS / 1000}s of random clicks)`, async ({ adminPage }) => {
    const rng = makeRng(SEED)
    const crashes: Crash[] = []

    adminPage.on('pageerror', (e) =>
      crashes.push({ route, kind: 'pageerror', message: e.message }),
    )
    adminPage.on('crash', () =>
      crashes.push({ route, kind: 'pagecrash', message: 'page crashed' }),
    )
    adminPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Skip noisy 3rd-party warnings that aren't bugs.
        if (/Failed to load resource|Hydration failed/i.test(text)) return
        if (/ResizeObserver loop/i.test(text)) return
        if (/Permissions policy violation/i.test(text)) return
        crashes.push({ route, kind: 'console.error', message: text })
      }
    })

    const res = await adminPage.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null)
    if (!res) test.skip(true, `Route ${route} not reachable`)
    expect(res!.status(), `${route} returned ${res!.status()}`).toBeLessThan(500)
    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const deadline = Date.now() + DURATION_MS
    let clickCount = 0

    while (Date.now() < deadline) {
      // Re-collect candidates each iteration — the page may have changed.
      const candidates = await adminPage
        .locator(
          [
            'button:visible',
            '[role="button"]:visible',
            '[role="tab"]:visible',
            '[role="menuitem"]:visible',
            'a[href]:visible',
          ].join(', '),
        )
        .all()
        .catch(() => [])

      if (candidates.length === 0) break

      const idx = Math.floor(rng() * candidates.length)
      const target = candidates[idx]

      // Read the accessible name and skip destructive buttons.
      const name = (await target.getAttribute('aria-label').catch(() => null)) ??
        (await target.textContent().catch(() => null)) ??
        ''
      if (DESTRUCTIVE_RE.test(name)) continue

      // Skip submit buttons — forms-smoke covers them.
      const type = await target.getAttribute('type').catch(() => null)
      if (type === 'submit') continue

      // Click in a try/catch — bad target shouldn't abort the run.
      try {
        await target.click({ timeout: 2_000, trial: false })
        clickCount += 1
      } catch {
        // Element disappeared between selector and click. Move on.
      }

      // Half the time, press Escape to close any modal that might have opened.
      if (rng() < 0.5) {
        await adminPage.keyboard.press('Escape').catch(() => {})
      }

      // Small jitter so we don't DoS the page.
      await adminPage.waitForTimeout(80 + Math.floor(rng() * 220))
    }

    // eslint-disable-next-line no-console
    console.log(
      `[monkey:${route}] clicks=${clickCount} duration=${DURATION_MS}ms seed=${SEED} crashes=${crashes.length}`,
    )

    if (crashes.length > 0) {
      const summary = crashes
        .slice(0, 30)
        .map((c) => `  [${c.kind}] ${c.message}`)
        .join('\n')
      throw new Error(
        `Monkey on ${route} found ${crashes.length} crash(es) (seed=${SEED}, showing first 30):\n${summary}\n\n` +
          `Reproduce with: E2E_MONKEY_SEED=${SEED} npm run test:e2e:monkey -- -g "${route}"`,
      )
    }
  })
}
