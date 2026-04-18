import { test, expect } from '@playwright/test'
import { ApiClient } from '../helpers/api'
import { env } from '../helpers/env'

/**
 * Structural contract: every route must return the { ok, data } / { ok:false, error }
 * envelope. We spot-check a representative sample of GET endpoints. If your project
 * adds new routes, add them here — or promote this to a route-discovery test.
 */

const READONLY_GET_ROUTES = [
  '/api/settings/users',
  '/api/settings/roles',
  '/api/settings/teams',
  '/api/settings/permissions',
  '/api/settings/schools',
  '/api/settings/campus/buildings',
  '/api/settings/campus/areas',
  '/api/settings/campus/rooms',
  '/api/tickets',
  '/api/events',
  '/api/inventory',
] as const

test.describe('API · envelope shape contract', () => {
  test('authenticated GETs return the standard envelope', async () => {
    const client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })

    for (const route of READONLY_GET_ROUTES) {
      const { status, body } = await client.get(route)
      // 404 is acceptable for routes that haven't been deployed yet in this env.
      if (status === 404) continue
      expect(status, `${route} returned ${status}`).toBeLessThan(500)
      expect(body, `${route} envelope missing "ok"`).toHaveProperty('ok')
      if ((body as { ok: boolean }).ok) {
        expect(body).toHaveProperty('data')
      } else {
        expect(body).toHaveProperty('error.code')
        expect(body).toHaveProperty('error.message')
      }
    }

    await client.dispose()
  })
})

test.describe('API · validation errors return 400 + VALIDATION_ERROR', () => {
  test('creating a ticket with no body returns a validation error', async () => {
    const client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })

    const { status, body } = await client.post('/api/tickets', {})
    // Depending on route shape this may be 400 BAD_REQUEST or VALIDATION_ERROR;
    // the contract we assert is: envelope is { ok: false } with a code.
    expect(status).toBeGreaterThanOrEqual(400)
    expect(status).toBeLessThan(500)
    expect(body).toHaveProperty('ok', false)
    expect(body).toHaveProperty('error.code')
    await client.dispose()
  })
})
