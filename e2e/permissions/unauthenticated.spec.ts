import { test, expect } from '@playwright/test'
import { ApiClient } from '../helpers/api'

/**
 * Unauthenticated clients must NOT be able to read any org-scoped data.
 * Public endpoints (login, slug-check, signup, branding) are excluded.
 */

const PROTECTED_ROUTES = [
  '/api/settings/users',
  '/api/settings/roles',
  '/api/settings/teams',
  '/api/settings/schools',
  '/api/settings/campus/buildings',
  '/api/tickets',
  '/api/events',
  '/api/inventory',
  '/api/auth/profile',
] as const

test.describe('Security · unauthenticated access', () => {
  test('protected routes return 401/403 for anonymous clients', async () => {
    const client = await ApiClient.anonymous()

    for (const route of PROTECTED_ROUTES) {
      const { status, body } = await client.get(route)
      if (status === 404) continue // route not deployed in this env
      expect([401, 403], `${route} returned ${status}`).toContain(status)
      expect(body).toHaveProperty('ok', false)
    }

    await client.dispose()
  })
})
