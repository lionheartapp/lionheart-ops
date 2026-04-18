import { Page, BrowserContext, expect } from '@playwright/test'
import { env } from './env'

/**
 * UI-side login helper. Drives the actual login form so we exercise the
 * real auth journey at least once per session. For pure data-setup work,
 * prefer ApiClient.login() — much faster.
 */
export async function uiLogin(
  page: Page,
  opts: { email?: string; password?: string; orgSlug?: string } = {},
): Promise<void> {
  const email = opts.email ?? env.orgA.adminEmail
  const password = opts.password ?? env.orgA.adminPassword
  const slug = opts.orgSlug ?? env.orgA.slug

  await page.goto(`/login?org=${encodeURIComponent(slug)}`)

  // Form selectors are intentionally permissive — accept either role-based or
  // name-based queries so a small UI rename doesn't break every test.
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Successful login lands on either /dashboard or the tenant root.
  await expect(page).toHaveURL(/\/(dashboard|app|it|av|facilities|settings|\[?tenant\]?)/, {
    timeout: 15_000,
  })
}

/**
 * Programmatic login that seeds the auth cookie on a BrowserContext without
 * driving the UI. Use in `beforeEach` / fixtures when the login form itself
 * is not what's being tested.
 */
export async function apiLogin(
  context: BrowserContext,
  opts: { email?: string; password?: string; organizationId?: string } = {},
): Promise<void> {
  const email = opts.email ?? env.orgA.adminEmail
  const password = opts.password ?? env.orgA.adminPassword
  const organizationId = opts.organizationId ?? env.orgA.id

  const res = await context.request.post(`${env.baseUrl}/api/auth/login`, {
    data: { email, password, organizationId },
    headers: { 'content-type': 'application/json' },
  })
  expect(res.status(), `apiLogin failed: ${await res.text()}`).toBe(200)
  // Cookie is set on the context automatically — subsequent page.goto inherits it.
}

export async function uiLogout(page: Page): Promise<void> {
  // Best-effort: try a logout endpoint, then a UI menu, otherwise just clear cookies.
  const res = await page.request.post('/api/auth/logout').catch(() => null)
  if (!res || !res.ok()) {
    await page.context().clearCookies()
  }
}
