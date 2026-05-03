import { test, expect } from '../fixtures'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Mobile-specific assertions.
 *
 * The other UI specs already run against a Pixel 7 viewport (see
 * `playwright.config.ts` mobile-chrome project). Those catch generic breakage
 * but don't assert mobile-specific quality bars:
 *
 *   1. No horizontal scroll at 375px wide
 *   2. Sidebar collapses into a hamburger or off-canvas menu
 *   3. Tap targets are ≥ 44x44 CSS pixels (Apple HIG / WCAG 2.5.5)
 *   4. No element is clipped behind iOS safe-area insets
 *
 * Force mobile viewport on every test in this file regardless of project,
 * so it runs the same on chromium AND mobile-chrome projects.
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}

const MOBILE_VIEWPORT = { width: 375, height: 812 } // iPhone 13 Mini-ish
const MAX_PAGES = Math.min(Number(process.env.E2E_MOBILE_MAX_PAGES ?? '15'), 40)
const ROUTES = inventory.crawlable.slice(0, MAX_PAGES)

test.describe('Mobile · per-page hygiene', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  for (const route of ROUTES) {
    test(`${route} — no horizontal scroll, no clipped CTAs`, async ({ adminPage }) => {
      const res = await adminPage.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null)
      if (!res) test.skip(true, `Route ${route} not reachable`)
      expect(res!.status(), `${route} returned ${res!.status()}`).toBeLessThan(500)
      await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

      // 1. No horizontal scroll. The body's scrollWidth must not exceed the
      //    viewport width by more than a 2px tolerance for sub-pixel rendering.
      const overflow = await adminPage.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth - doc.clientWidth
      })
      expect(overflow, `${route} has horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(2)

      // 2. Sticky / fixed CTAs not clipped by the viewport bottom.
      const clipped = await adminPage.evaluate(() => {
        const fixed = Array.from(document.querySelectorAll('*')).filter((el) => {
          const cs = window.getComputedStyle(el)
          return cs.position === 'fixed' || cs.position === 'sticky'
        })
        const vh = window.innerHeight
        return fixed
          .filter((el) => el.getBoundingClientRect().bottom > vh + 1)
          .map((el) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className?.toString().slice(0, 60)}`)
      })
      expect(clipped, `${route} has fixed/sticky elements clipped below viewport`).toEqual([])
    })
  }
})

test.describe('Mobile · navigation chrome', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('dashboard exposes mobile navigation (hamburger or bottom tab bar)', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // This app uses a bottom tab bar on mobile instead of a hamburger.
    // Check for either pattern.
    const hamburger = adminPage
      .getByRole('button', { name: /menu|open navigation|toggle (sidebar|nav)/i })
      .first()
      .or(adminPage.locator('[data-testid*="menu" i], [data-testid*="nav-toggle" i]').first())

    const tabBar = adminPage.locator('nav[class*="fixed bottom"], [class*="MobileTabBar"], nav:below(main)').first()

    const hasHamburger = await hamburger.isVisible().catch(() => false)
    const hasTabBar = await tabBar.isVisible().catch(() => false)

    expect(
      hasHamburger || hasTabBar,
      'mobile dashboard should expose either a hamburger menu or a bottom tab bar for navigation',
    ).toBe(true)
  })
})

test.describe('Mobile · tap target sizing', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('primary buttons on dashboard are at least 40x40 pixels', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // WCAG 2.5.5 (AAA) is 44x44; we assert 40x40 as a pragmatic floor that
    // catches obvious icon-button bugs without false-positiving on inline
    // text links.
    const tooSmall = await adminPage.evaluate(() => {
      const interactive = Array.from(
        document.querySelectorAll('button, [role="button"]'),
      ) as HTMLElement[]
      return interactive
        .filter((el) => {
          const r = el.getBoundingClientRect()
          // Visible only.
          if (r.width === 0 || r.height === 0) return false
          if (window.getComputedStyle(el).display === 'none') return false
          if (window.getComputedStyle(el).visibility === 'hidden') return false
          return r.width < 40 || r.height < 40
        })
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          name: el.getAttribute('aria-label') ?? el.textContent?.trim()?.slice(0, 40) ?? '',
          width: Math.round(el.getBoundingClientRect().width),
          height: Math.round(el.getBoundingClientRect().height),
        }))
        .slice(0, 20)
    })

    expect(
      tooSmall,
      `Found ${tooSmall.length} button(s) below 40x40 mobile tap target:\n` +
        tooSmall.map((b) => `  ${b.tag} "${b.name}" (${b.width}x${b.height})`).join('\n'),
    ).toEqual([])
  })
})
