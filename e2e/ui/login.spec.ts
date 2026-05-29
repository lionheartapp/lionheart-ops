import { test, expect } from '@playwright/test'
import { env } from '../helpers/env'

async function openOrgLoginForm(page: import('@playwright/test').Page) {
  await page.goto('/login')
  const schoolUrl = page.getByLabel(/school url/i)
  if (await schoolUrl.isVisible().catch(() => false)) {
    await schoolUrl.fill(env.orgA.slug)
    await page.getByRole('button', { name: /continue/i }).click()
  }
  await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 15_000 })
}

function passwordField(page: import('@playwright/test').Page) {
  return page.getByRole('textbox', { name: /^password$/i })
}

test.describe('Login page', () => {
  test('renders login form and validates empty submit', async ({ page }) => {
    await openOrgLoginForm(page)
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(passwordField(page)).toBeVisible()

    const submit = page.getByRole('button', { name: /sign in|log in/i })
    await expect(submit).toBeVisible()

    // Empty submit should not navigate away.
    await submit.click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('rejects invalid credentials with an error message', async ({ page }) => {
    await openOrgLoginForm(page)
    await page.getByLabel(/email/i).fill('does-not-exist@lionheart-test.com')
    await passwordField(page).fill('definitely-wrong-password-123')
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Any one of these error indicators is acceptable — UI copy shouldn't gate tests.
    const errorRegex = /invalid|incorrect|wrong|not found|unauthori[sz]ed/i
    await expect(page.getByText(errorRegex).first()).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin can sign in and lands on an authenticated page', async ({ page }) => {
    await openOrgLoginForm(page)
    await page.getByLabel(/email/i).fill(env.orgA.adminEmail)
    await passwordField(page).fill(env.orgA.adminPassword)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Any post-login route — dashboard, tenant root, app shell, or settings.
    await page.waitForURL(/\/(dashboard|app|it|av|facilities|settings)/, { timeout: 15_000 })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
