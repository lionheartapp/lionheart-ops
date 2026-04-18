import { test as base, expect, Page } from '@playwright/test'
import { ApiClient } from '../helpers/api'
import { apiLogin } from '../helpers/auth'
import { env } from '../helpers/env'

/**
 * Custom Playwright test with shared Lionheart fixtures.
 *
 * Usage:
 *   import { test, expect } from '../fixtures'
 *   test('admin can see settings', async ({ adminPage }) => { ... })
 */

type LionheartFixtures = {
  /** Authenticated ApiClient for Org A admin. */
  adminApi: ApiClient
  /** Authenticated ApiClient for Org A member (low privilege). */
  memberApi: ApiClient
  /** Authenticated ApiClient for Org B admin (tenancy isolation tests). */
  orgBApi: ApiClient
  /** A Page already signed in as Org A admin. */
  adminPage: Page
  /** A Page already signed in as Org A member. */
  memberPage: Page
}

export const test = base.extend<LionheartFixtures>({
  adminApi: async ({}, use) => {
    const client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
    await use(client)
    await client.dispose()
  },

  memberApi: async ({}, use) => {
    const client = await ApiClient.login({
      email: env.orgA.memberEmail,
      password: env.orgA.memberPassword,
      organizationId: env.orgA.id,
    })
    await use(client)
    await client.dispose()
  },

  orgBApi: async ({}, use) => {
    if (!env.hasOrgB()) {
      throw new Error(
        '[e2e] Org B env vars not set. Skip this test or configure E2E_ORG_B_* vars.',
      )
    }
    const client = await ApiClient.login({
      email: env.orgB.adminEmail,
      password: env.orgB.adminPassword,
      organizationId: env.orgB.id,
    })
    await use(client)
    await client.dispose()
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    await apiLogin(context, {
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },

  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    await apiLogin(context, {
      email: env.orgA.memberEmail,
      password: env.orgA.memberPassword,
      organizationId: env.orgA.id,
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect }
