import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger to suppress warnings in tests
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { verifyTurnstile } from '@/lib/turnstile'

describe('verifyTurnstile', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns true in dev mode when TURNSTILE_SECRET_KEY is not set', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const result = await verifyTurnstile('any-token')
    expect(result).toBe(true)
  })

  it('calls Cloudflare API when secret is set and returns true on success', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    const result = await verifyTurnstile('valid-token', '1.2.3.4')
    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()

    // Verify the URL
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
  })

  it('returns false when Cloudflare says success: false', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 })
    )

    const result = await verifyTurnstile('invalid-token')
    expect(result).toBe(false)
  })

  it('includes remoteip in body when ip is provided', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    await verifyTurnstile('token', '192.168.1.1')

    const [, init] = fetchSpy.mock.calls[0]
    const body = (init as RequestInit).body as URLSearchParams
    expect(body.get('remoteip')).toBe('192.168.1.1')
  })

  it('omits remoteip when ip is not provided', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    await verifyTurnstile('token')

    const [, init] = fetchSpy.mock.calls[0]
    const body = (init as RequestInit).body as URLSearchParams
    expect(body.has('remoteip')).toBe(false)
  })
})
