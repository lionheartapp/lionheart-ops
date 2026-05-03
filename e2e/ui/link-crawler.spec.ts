import { test, expect } from '../fixtures'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Link crawler — BFS-walks every internal link reachable from /dashboard
 * (and the full page-inventory seed list) and asserts:
 *   1. Each navigation completes
 *   2. The final response is not 4xx / 5xx
 *   3. The page does not render a known error sentinel ("404", "Server error", etc.)
 *
 * The seed list is auto-generated from src/app/**\/page.tsx by
 * `scripts/inventory-pages.mjs`. Re-run that script after adding pages.
 *
 * Configurable via env:
 *   E2E_CRAWLER_MAX_DEPTH  — link traversal depth (default 2)
 *   E2E_CRAWLER_MAX_PAGES  — total pages to visit (default 120, hard ceiling 300)
 *   E2E_CRAWLER_SCREENSHOT — "1" to save a screenshot per page (test-results/crawler/*.png)
 *
 * Notes:
 *  - Only same-origin links are crawled (no external sites).
 *  - URL fragments (#x) and query strings are normalized so we don't visit dupes.
 *  - We skip routes that would log the user out, trigger downloads, or
 *    perform destructive actions ("delete", "remove", "trash", "logout", "signout").
 *  - Failed pages are collected and reported at the end so a single broken link
 *    doesn't mask the rest. The test still fails if any page failed.
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}
const SEED_PATHS: readonly string[] = inventory.crawlable

const SKIP_PATH_PATTERNS = [
  /\/api\//i,
  /logout/i,
  /signout|sign-out/i,
  /delete/i,
  /remove/i,
  /trash/i,
  /reset-password/i,
  /set-password/i,
  /\.(pdf|csv|xlsx|zip|png|jpg|jpeg|svg|ico|gif|webp|woff2?|ttf)$/i,
]

const ERROR_SENTINELS = [
  /^404$/i,
  /not found/i,
  /something went wrong/i,
  /internal server error/i,
  /^500$/i,
  /^503$/i,
  /^502$/i,
] as const

const MAX_DEPTH = Number(process.env.E2E_CRAWLER_MAX_DEPTH ?? '2')
const MAX_PAGES = Math.min(Number(process.env.E2E_CRAWLER_MAX_PAGES ?? '120'), 300)
const TAKE_SCREENSHOTS = process.env.E2E_CRAWLER_SCREENSHOT === '1'

interface CrawlFailure {
  url: string
  reason: string
  fromPath: string
  depth: number
}

function normalizePath(rawHref: string, baseUrl: URL): string | null {
  try {
    const url = new URL(rawHref, baseUrl)
    if (url.origin !== baseUrl.origin) return null
    // Drop hash + query — same logical page for crawling purposes.
    return url.pathname.replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
}

function shouldSkip(pathname: string): boolean {
  return SKIP_PATH_PATTERNS.some((p) => p.test(pathname))
}

test.describe('Crawler · internal links', () => {
  // The crawler is one big BFS — it deserves its own time budget.
  test.setTimeout(180_000)

  test('every reachable internal page returns 2xx/3xx', async ({ adminPage }) => {
    const baseUrl = new URL(adminPage.url() || 'http://localhost:3004')
    // Recompute baseUrl after first navigation so we get the real origin.
    await adminPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    const realBase = new URL(adminPage.url())

    const visited = new Set<string>()
    const queue: Array<{ path: string; depth: number; from: string }> = []
    const failures: CrawlFailure[] = []

    for (const seed of SEED_PATHS) {
      queue.push({ path: seed, depth: 0, from: '(seed)' })
    }

    let visitsCompleted = 0

    while (queue.length > 0 && visitsCompleted < MAX_PAGES) {
      const next = queue.shift()!
      if (visited.has(next.path)) continue
      visited.add(next.path)

      const targetUrl = new URL(next.path, realBase).toString()
      let status: number | null = null
      try {
        const response = await adminPage.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20_000,
        })
        status = response?.status() ?? null
      } catch (err) {
        failures.push({
          url: targetUrl,
          reason: `navigation threw: ${(err as Error).message}`,
          fromPath: next.from,
          depth: next.depth,
        })
        continue
      }

      visitsCompleted += 1

      if (status !== null && status >= 400) {
        failures.push({
          url: targetUrl,
          reason: `HTTP ${status}`,
          fromPath: next.from,
          depth: next.depth,
        })
        continue
      }

      // Soft-error detection — page rendered but shows an error sentinel
      // in a heading or large body element.
      try {
        const headingText = (
          await adminPage.locator('h1, h2, [role="heading"]').first().textContent({ timeout: 2_000 })
        )?.trim() ?? ''
        if (headingText && ERROR_SENTINELS.some((p) => p.test(headingText))) {
          failures.push({
            url: targetUrl,
            reason: `error sentinel in heading: "${headingText}"`,
            fromPath: next.from,
            depth: next.depth,
          })
        }
      } catch {
        // Heading not found within timeout — that's fine, not all pages have one.
      }

      if (TAKE_SCREENSHOTS) {
        const safeName = next.path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'
        await adminPage
          .screenshot({
            path: `test-results/crawler/${String(visitsCompleted).padStart(3, '0')}_${safeName}.png`,
            fullPage: true,
          })
          .catch(() => {
            /* screenshot failure shouldn't fail the crawl */
          })
      }

      if (next.depth >= MAX_DEPTH) continue

      // Collect outbound internal links from this page.
      const hrefs = await adminPage
        .locator('a[href]')
        .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))
        .catch(() => [] as string[])

      const seen = new Set<string>()
      for (const href of hrefs) {
        if (!href) continue
        const normalized = normalizePath(href, realBase)
        if (!normalized) continue
        if (shouldSkip(normalized)) continue
        if (visited.has(normalized)) continue
        if (seen.has(normalized)) continue
        seen.add(normalized)
        queue.push({ path: normalized, depth: next.depth + 1, from: next.path })
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[crawler] visited=${visitsCompleted} queued_remaining=${queue.length} failures=${failures.length}`,
    )

    if (failures.length > 0) {
      const summary = failures
        .map((f) => `  - ${f.url} (depth ${f.depth}, from ${f.fromPath}): ${f.reason}`)
        .join('\n')
      throw new Error(
        `${failures.length} page(s) failed during crawl:\n${summary}\n\n` +
          `Visited ${visitsCompleted} page(s) total.`,
      )
    }

    expect(visitsCompleted, 'crawler visited at least the seed pages').toBeGreaterThan(0)
  })
})
