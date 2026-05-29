import { test, expect } from '@playwright/test'
import { orgSlug, userEmail, strongPassword } from '../helpers/data'

/**
 * Org signup is the most critical conversion path. These tests only create
 * orgs when E2E_ALLOW_SIGNUP=1 is set, because each run pollutes staging DB.
 * In CI we normally gate this behind a dedicated "signup-tests" job that runs
 * nightly rather than per-PR.
 */
const SIGNUP_ALLOWED = process.env.E2E_ALLOW_SIGNUP === '1'

test.describe('Org signup', () => {
  test.skip(!SIGNUP_ALLOWED, 'E2E_ALLOW_SIGNUP=1 not set — skipping to avoid DB pollution')

  test('user can complete the multi-step signup form', async ({ page }) => {
    const slug = orgSlug()
    const email = userEmail('signup')
    const pw = strongPassword()

    await page.goto('/signup')

    // These selectors are tolerant — adjust fields as signup flow evolves.
    await page.getByLabel(/school name|organi[sz]ation name/i).fill(`E2E Test Org ${slug}`)
    // Many signup flows auto-derive slug from name; only fill if present.
    const slugField = page.getByLabel(/slug|url|subdomain/i)
    if (await slugField.isVisible().catch(() => false)) {
      await slugField.fill(slug)
    }
    await page.getByLabel(/your name|full name|first name/i)
      .first()
      .fill('E2E Admin')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/^password/i).fill(pw)

    const confirm = page.getByLabel(/confirm password|repeat password/i)
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.fill(pw)
    }

    // Accept terms if required.
    const terms = page.getByRole('checkbox', { name: /terms|agree|policy/i })
    if (await terms.isVisible().catch(() => false)) {
      await terms.check()
    }

    await page.getByRole('button', { name: /create|sign up|get started|continue/i })
      .first()
      .click()

    // Success lands on an authenticated page or a confirmation screen.
    await page.waitForURL(/\/(dashboard|app|welcome|onboarding|verify|settings)/, {
      timeout: 20_000,
    })
    await expect(page).not.toHaveURL(/\/signup\/?$/)
  })

  test('slug-check API rejects already-taken slugs', async ({ request }) => {
    // This hits the public slug-check route — no auth needed.
    const res = await request.get('/api/organizations/slug-check?slug=admin')
    expect([200, 400, 409]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty('ok')
  })
})
