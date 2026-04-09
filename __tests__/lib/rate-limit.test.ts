import { describe, it, expect, vi, afterEach } from 'vitest'
import { RateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', async () => {
    const limiter = new RateLimiter({ name: 'test-under', windowMs: 60_000, maxAttempts: 3 })
    const result = await limiter.hit('ip-1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('blocks requests at the limit', async () => {
    const limiter = new RateLimiter({ name: 'test-blocks', windowMs: 60_000, maxAttempts: 2 })
    await limiter.hit('ip-1')
    await limiter.hit('ip-1')
    const result = await limiter.hit('ip-1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('allows requests after window expires', async () => {
    vi.useFakeTimers()
    const limiter = new RateLimiter({ name: 'test-expire', windowMs: 1000, maxAttempts: 1 })
    await limiter.hit('ip-1')
    expect((await limiter.hit('ip-1')).allowed).toBe(false)

    vi.advanceTimersByTime(1001)
    expect((await limiter.hit('ip-1')).allowed).toBe(true)
  })

  it('returns full remaining for unknown keys', async () => {
    const limiter = new RateLimiter({ name: 'test-unknown', windowMs: 60_000, maxAttempts: 5 })
    const result = await limiter.check('unknown')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
    expect(result.retryAfterMs).toBe(0)
  })

  it('reset() clears attempts for a key', async () => {
    const limiter = new RateLimiter({ name: 'test-reset', windowMs: 60_000, maxAttempts: 1 })
    await limiter.hit('ip-1')
    expect((await limiter.hit('ip-1')).allowed).toBe(false)

    await limiter.reset('ip-1')
    const after = await limiter.hit('ip-1')
    expect(after.allowed).toBe(true)
    expect(after.remaining).toBe(0)
  })

  it('isolates keys from each other', async () => {
    const limiter = new RateLimiter({ name: 'test-isolate', windowMs: 60_000, maxAttempts: 1 })
    await limiter.hit('ip-1')
    expect((await limiter.hit('ip-1')).allowed).toBe(false)
    expect((await limiter.hit('ip-2')).allowed).toBe(true)
  })
})

describe('getRateLimitHeaders', () => {
  it('returns correct headers', () => {
    const headers = getRateLimitHeaders({ remaining: 3, retryAfterMs: 5500 })
    expect(headers['X-RateLimit-Remaining']).toBe('3')
    expect(headers['Retry-After']).toBe('6') // ceil(5500/1000)
  })

  it('returns 0 Retry-After when no wait needed', () => {
    const headers = getRateLimitHeaders({ remaining: 5, retryAfterMs: 0 })
    expect(headers['Retry-After']).toBe('0')
  })
})
