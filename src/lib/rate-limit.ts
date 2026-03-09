/**
 * In-memory sliding window rate limiter.
 *
 * Suitable for single-process environments (Vercel serverless function instances).
 * For horizontal scaling with shared state, Redis would be required (deferred to v2.1).
 *
 * Usage:
 *   import { loginRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
 *
 *   const ip = getIp(req) ?? 'unknown'
 *   loginRateLimiter.increment(ip)
 *   const result = loginRateLimiter.check(ip)
 *   if (!result.allowed) {
 *     return NextResponse.json(fail('RATE_LIMITED', '...'), {
 *       status: 429,
 *       headers: getRateLimitHeaders(result),
 *     })
 *   }
 */

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Maximum number of attempts allowed within the window */
  maxAttempts: number
}

interface RateLimitResult {
  /** Whether the request is allowed to proceed */
  allowed: boolean
  /** Number of remaining attempts in the current window */
  remaining: number
  /** Milliseconds until the oldest attempt expires (0 if within limit) */
  retryAfterMs: number
}

interface BucketEntry {
  timestamps: number[]
}

export class RateLimiter {
  private readonly windowMs: number
  private readonly maxAttempts: number
  private readonly store: Map<string, BucketEntry> = new Map()
  private readonly cleanupInterval: ReturnType<typeof setInterval>

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs
    this.maxAttempts = options.maxAttempts

    // Prune stale entries every 5 minutes to prevent unbounded memory growth
    this.cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000)

    // Allow Node.js process to exit without waiting for this interval
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Slide the window and return the current rate-limit status for a key.
   * Does NOT record an attempt — call `increment` first.
   */
  check(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const entry = this.store.get(key)

    if (!entry || entry.timestamps.length === 0) {
      return { allowed: true, remaining: this.maxAttempts, retryAfterMs: 0 }
    }

    // Slide the window: keep only timestamps within the current window
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart)
    entry.timestamps = validTimestamps

    const count = validTimestamps.length
    const allowed = count < this.maxAttempts
    const remaining = Math.max(0, this.maxAttempts - count)

    let retryAfterMs = 0
    if (!allowed && validTimestamps.length > 0) {
      // Oldest timestamp in the window — waiting for it to expire clears one slot
      const oldest = validTimestamps[0]
      retryAfterMs = Math.max(0, oldest + this.windowMs - now)
    }

    return { allowed, remaining, retryAfterMs }
  }

  /**
   * Record an attempt for the given key.
   * Call this BEFORE `check` so that the current request is counted.
   */
  increment(key: string): void {
    const now = Date.now()
    const entry = this.store.get(key)
    if (entry) {
      entry.timestamps.push(now)
    } else {
      this.store.set(key, { timestamps: [now] })
    }
  }

  /**
   * Clear all recorded attempts for a key (e.g., after a successful login).
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Remove entries whose entire timestamp list has expired out of the window.
   * Called automatically every 5 minutes.
   */
  private _cleanup(): void {
    const windowStart = Date.now() - this.windowMs
    for (const [key, entry] of this.store.entries()) {
      const valid = entry.timestamps.filter(ts => ts > windowStart)
      if (valid.length === 0) {
        this.store.delete(key)
      } else {
        entry.timestamps = valid
      }
    }
  }
}

// ─────────────────────────────────────────────
//  Pre-configured instances
// ─────────────────────────────────────────────

/** Login endpoint: 5 failed attempts per 15 minutes per IP */
export const loginRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
})

/** General public API endpoints: 30 requests per minute per IP */
export const publicApiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxAttempts: 30,
})

/** Signup endpoint: 5 registrations per hour per IP */
export const signupRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 5,
})

// ─────────────────────────────────────────────
//  Response header helper
// ─────────────────────────────────────────────

/**
 * Build standard rate-limit response headers.
 *
 * @returns Headers to include on 429 responses:
 *   - `X-RateLimit-Remaining`: attempts left in the current window
 *   - `Retry-After`: seconds until at least one slot opens up
 */
export function getRateLimitHeaders(result: Pick<RateLimitResult, 'remaining' | 'retryAfterMs'>): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
  }
}
