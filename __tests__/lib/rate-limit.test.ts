import { describe, it, expect, vi, afterEach } from 'vitest'
import { RateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxAttempts: 3 })
    limiter.increment('ip-1')
    const result = limiter.check('ip-1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('blocks requests at the limit', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxAttempts: 2 })
    limiter.increment('ip-1')
    limiter.increment('ip-1')
    const result = limiter.check('ip-1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('allows requests after window expires', () => {
    vi.useFakeTimers()
    const limiter = new RateLimiter({ windowMs: 1000, maxAttempts: 1 })
    limiter.increment('ip-1')
    expect(limiter.check('ip-1').allowed).toBe(false)

    vi.advanceTimersByTime(1001)
    expect(limiter.check('ip-1').allowed).toBe(true)
  })

  it('returns full remaining for unknown keys', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxAttempts: 5 })
    const result = limiter.check('unknown')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
    expect(result.retryAfterMs).toBe(0)
  })

  it('reset() clears attempts for a key', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxAttempts: 1 })
    limiter.increment('ip-1')
    expect(limiter.check('ip-1').allowed).toBe(false)

    limiter.reset('ip-1')
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-1').remaining).toBe(1)
  })

  it('isolates keys from each other', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxAttempts: 1 })
    limiter.increment('ip-1')
    expect(limiter.check('ip-1').allowed).toBe(false)
    expect(limiter.check('ip-2').allowed).toBe(true)
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
