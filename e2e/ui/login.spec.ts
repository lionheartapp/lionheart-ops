import { test, expect } from '@playwright/test'
import { env } from '../helpers/env'

test.describe('Login page', () => {
  test('renders login form and validates empty submit', async ({ page }) => {
    await page.goto(`/login?org=${env.orgA.slug}`)
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()

    const submit = page.getByRole('button', { name: /sign in|log in/i })
    await expect(submit).toBeVisible()

    // Empty submit should not navigate away.
    await submit.click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('rejects invalid credentials with an error message', async ({ page }) => {
    await page.goto(`/login?org=${env.orgA.slug}`)
    await page.getByLabel(/email/i).fill('does-not-exist@lionheart-test.com')
    await page.getByLabel(/password/i).fill('definitely-wrong-password-123')
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Any one of these error indicators is acceptable — UI copy shouldn't gate tests.
    const errorRegex = /invalid|incorrect|wrong|not found|unauthori[sz]ed/i
    await expect(page.getByText(errorRegex).first()).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin can sign in and lands on an authenticated page', async ({ page }) => {
    await page.goto(`/login?org=${env.orgA.slug}`)
    await page.getByLabel(/email/i).fill(env.orgA.adminEmail)
    await page.getByLabel(/password/i).fill(env.orgA.adminPassword)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Any post-login route — dashboard, tenant root, app shell, or settings.
    await page.waitForURL(/\/(dashboard|app|it|av|facilities|settings)/, { timeout: 15_000 })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
