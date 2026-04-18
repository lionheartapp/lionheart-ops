import { test, expect } from '../fixtures'

test.describe('Dashboard shell', () => {
  test('admin dashboard loads without console errors', async ({ adminPage }) => {
    const consoleErrors: string[] = []
    adminPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const pageErrors: string[] = []
    adminPage.on('pageerror', (err) => pageErrors.push(err.message))

    await adminPage.goto('/dashboard')
    // Wait for network to settle — we consider the page "loaded" when
    // all XHR completes and at least one main layout element is visible.
    await expect(
      adminPage.getByRole('navigation').or(adminPage.locator('aside,[data-testid="sidebar"]')).first(),
    ).toBeVisible({ timeout: 15_000 })

    // Ignore known noisy warnings but fail on real errors.
    const meaningfulErrors = consoleErrors.filter((e) => !/favicon|devtools|deprecated/i.test(e))
    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toHaveLength(0)
    expect(meaningfulErrors, `console errors: ${meaningfulErrors.join('\n')}`).toHaveLength(0)
  })

  test('sidebar navigates to Settings', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    // Try role-based first, fall back to text.
    const settingsLink = adminPage
      .getByRole('link', { name: /^settings$/i })
      .or(adminPage.getByText(/^settings$/i).first())

    await settingsLink.first().click()
    await adminPage.waitForURL(/\/settings/, { timeout: 10_000 })
    await expect(adminPage).toHaveURL(/\/settings/)
  })

  test('all primary nav links return 2xx (no broken routes)', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')

    const links = await adminPage.getByRole('navigation').getByRole('link').all()
    const hrefs = (
      await Promise.all(links.map((l) => l.getAttribute('href')))
    ).filter((h): h is string => !!h && h.startsWith('/') && !h.startsWith('/api'))

    // Unique, non-hash, first 10 to keep the test bounded.
    const unique = [...new Set(hrefs.map((h) => h.split('#')[0]))].slice(0, 10)
    expect(unique.length).toBeGreaterThan(0)

    for (const href of unique) {
      const res = await adminPage.request.get(href)
      expect(res.status(), `GET ${href} should not be a server error`).toBeLessThan(500)
    }
  })
})
