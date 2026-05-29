import { expect } from '@playwright/test'
import { test as authedTest } from '../fixtures'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Link Checker — companion to link-crawler.spec.ts.
 *
 * The crawler verifies every internal *page* renders. The checker takes the
 * complementary angle: it collects every `<a href>` it sees on a sweep of the
 * app and probes the destination with a HEAD/GET request, including:
 *
 *   - external https links (footer, support, docs)
 *   - mailto: links (validates address shape)
 *   - tel: links (validates phone shape)
 *   - internal links the crawler may have skipped (e.g. /api/* downloads)
 *
 * Failures are reported in bulk so a single dead footer link doesn't mask the
 * other 50 you also need to fix. External links are deduped before probing so
 * we don't hit support@linfield.edu fifty times.
 *
 * Set E2E_LINK_CHECKER_EXTERNAL=0 to skip external probes (useful in CI when
 * external sites flake or rate-limit).
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}

const PROBE_PAGES = inventory.crawlable.slice(0, 30)
const PROBE_EXTERNAL = process.env.E2E_LINK_CHECKER_EXTERNAL !== '0'

interface Found {
  href: string
  fromPath: string
  text: string
}

interface Failure {
  href: string
  status: number | string
  reason: string
  fromPaths: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9\-().\s]{7,}$/

authedTest.describe('Link checker · collect + validate every href', () => {
  authedTest.setTimeout(240_000)

  authedTest('every link in the app resolves (no 404s, no broken mailto)', async ({ adminPage }) => {
    const found: Found[] = []

    // ---- 1. Collect every <a href> from a sweep of pages -----------------
    for (const route of PROBE_PAGES) {
      try {
        await adminPage.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 })
        await adminPage.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
        const hrefs = await adminPage
          .locator('a[href]')
          .evaluateAll((els) =>
            els.map((el) => ({
              href: (el as HTMLAnchorElement).getAttribute('href') ?? '',
              text: (el.textContent ?? '').trim().slice(0, 80),
            })),
          )
          .catch(() => [] as Array<{ href: string; text: string }>)
        for (const h of hrefs) {
          if (!h.href) continue
          found.push({ ...h, fromPath: route })
        }
      } catch {
        // Page didn't load — link-crawler will report it. Move on.
      }
    }

    // ---- 2. Dedupe by href, keeping the list of source pages ------------
    const byHref = new Map<string, { from: string[]; text: string }>()
    for (const f of found) {
      const entry = byHref.get(f.href) ?? { from: [], text: f.text }
      if (!entry.from.includes(f.fromPath)) entry.from.push(f.fromPath)
      byHref.set(f.href, entry)
    }

    const failures: Failure[] = []
    const currentOrigin = new URL(adminPage.url()).origin
    const probeCtx = adminPage.context().request

    // ---- 3. Probe each unique href --------------------------------------
    for (const [href, meta] of byHref) {
      // Skip in-page anchors and javascript:
      if (href.startsWith('#')) continue
      if (href.startsWith('javascript:')) continue

      // mailto: validate shape only
      if (href.startsWith('mailto:')) {
        const email = href.slice('mailto:'.length).split('?')[0]
        if (!EMAIL_RE.test(email)) {
          failures.push({
            href,
            status: 'invalid',
            reason: 'mailto: address does not look like a valid email',
            fromPaths: meta.from,
          })
        }
        continue
      }

      // tel: validate shape only
      if (href.startsWith('tel:')) {
        const phone = href.slice('tel:'.length)
        if (!PHONE_RE.test(phone)) {
          failures.push({
            href,
            status: 'invalid',
            reason: 'tel: number does not look like a valid phone',
            fromPaths: meta.from,
          })
        }
        continue
      }

      const targetUrl = new URL(href, currentOrigin)
      const isExternal = targetUrl.origin !== currentOrigin
      if (isExternal && !PROBE_EXTERNAL) continue

      try {
        // Use GET (some servers don't allow HEAD). Allow redirects.
        const res = await probeCtx.get(targetUrl.toString(), {
          maxRedirects: 5,
          timeout: 10_000,
          failOnStatusCode: false,
          headers: { 'user-agent': 'lionheart-e2e-link-checker' },
        })
        if (res.status() >= 400) {
          failures.push({
            href,
            status: res.status(),
            reason: `HTTP ${res.status()}`,
            fromPaths: meta.from,
          })
        }
      } catch (err) {
        failures.push({
          href,
          status: 'error',
          reason: `request failed: ${(err as Error).message}`,
          fromPaths: meta.from,
        })
      }
    }

    // ---- 4. Report -------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log(
      `[link-checker] pages_swept=${PROBE_PAGES.length} unique_hrefs=${byHref.size} failures=${failures.length}`,
    )

    if (failures.length > 0) {
      const summary = failures
        .slice(0, 50)
        .map(
          (f) =>
            `  [${f.status}] ${f.href}\n      from: ${f.fromPaths.slice(0, 3).join(', ')}${f.fromPaths.length > 3 ? '...' : ''}\n      reason: ${f.reason}`,
        )
        .join('\n')
      throw new Error(
        `${failures.length} broken link(s) found (showing first 50):\n${summary}`,
      )
    }

    expect(byHref.size, 'should have found at least some hrefs to probe').toBeGreaterThan(0)
  })
})
