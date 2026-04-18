import { test, expect } from '@playwright/test'
import { ApiClient } from '../helpers/api'
import { env } from '../helpers/env'

/**
 * /api/auth/login has IP-based rate limiting. Fire more requests than the bucket
 * allows and verify we eventually see RATE_LIMITED with a 429.
 *
 * Rate limiter is per-IP; this will trip your IP for a minute or so on staging.
 * Only run when E2E_TEST_RATE_LIMIT=1 to avoid flakes in shared pipelines.
 */
test.skip(
  process.env.E2E_TEST_RATE_LIMIT !== '1',
  'Set E2E_TEST_RATE_LIMIT=1 to exercise rate limits (will trip your IP)',
)

test('login rate limit returns 429 + RATE_LIMITED after bucket exhaustion', async () => {
  const client = await ApiClient.anonymous()
  let sawRateLimit = false

  for (let i = 0; i < 25; i++) {
    const { status, body } = await client.post('/api/auth/login', {
      email: 'rate-limit-probe@lionheart-test.com',
      password: 'wrong',
      organizationId: env.orgA.id,
    })
    if (status === 429) {
      expect(body).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } })
      sawRateLimit = true
      break
    }
  }

  expect(sawRateLimit, 'Never saw a 429 — rate limiter may be disabled').toBe(true)
  await client.dispose()
})
