/**
 * Rate limiter with optional distributed backend.
 *
 * Uses Upstash Redis (via REST API, no new dependency) for distributed
 * rate limiting across serverless instances when the following env vars
 * are configured:
 *
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Without Upstash configured, falls back to an in-memory sliding window
 * that is local to each serverless instance (best-effort enforcement).
 *
 * The public API is async to support either backend transparently:
 *
 *   const ip = getIp(req) ?? 'unknown'
 *   await loginRateLimiter.increment(ip)
 *   const result = await loginRateLimiter.check(ip)
 *   if (!result.allowed) {
 *     return NextResponse.json(fail('RATE_LIMITED', '...'), {
 *       status: 429,
 *       headers: getRateLimitHeaders(result),
 *     })
 *   }
 *
 * Redis backend uses a fixed-window counter (INCR + EXPIRE). It is less
 * precise than the in-memory sliding window at window boundaries but is
 * correct across instances, which matters more in production.
 */

interface RateLimiterOptions {
  /** Unique name for the limiter — used as a Redis key prefix */
  name: string
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
  /** Milliseconds until the window resets */
  retryAfterMs: number
}

interface BucketEntry {
  timestamps: number[]
}

// ─────────────────────────────────────────────
//  Upstash REST backend detection
// ─────────────────────────────────────────────

function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

interface UpstashPipelineResult {
  result?: unknown
  error?: string
}

async function upstashPipeline(commands: Array<Array<string | number>>): Promise<UpstashPipelineResult[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash env vars not configured')

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Upstash pipeline failed: ${res.status}`)
  }

  return (await res.json()) as UpstashPipelineResult[]
}

// ─────────────────────────────────────────────
//  RateLimiter — async, transparent backend
// ─────────────────────────────────────────────

export class RateLimiter {
  private readonly name: string
  private readonly windowMs: number
  private readonly maxAttempts: number
  // In-memory fallback (used when Redis is not configured)
  private readonly store: Map<string, BucketEntry> = new Map()
  private readonly cleanupInterval: ReturnType<typeof setInterval>

  constructor(options: RateLimiterOptions) {
    this.name = options.name
    this.windowMs = options.windowMs
    this.maxAttempts = options.maxAttempts

    // Prune stale in-memory entries every 5 minutes
    this.cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000)
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Record an attempt and return current status in one call. This is the
   * preferred API — avoids a race between increment and check.
   */
  async hit(key: string): Promise<RateLimitResult> {
    if (isRedisConfigured()) {
      return this._hitRedis(key)
    }
    return this._hitMemory(key)
  }

  /**
   * Check current status without recording an attempt. Only meaningful
   * after a prior `hit()` or `increment()` call.
   */
  async check(key: string): Promise<RateLimitResult> {
    if (isRedisConfigured()) {
      return this._checkRedis(key)
    }
    return this._checkMemory(key)
  }

  /** Record an attempt. Prefer `hit()` which is atomic. */
  async increment(key: string): Promise<void> {
    if (isRedisConfigured()) {
      await this._hitRedis(key) // atomic increment via Redis
      return
    }
    this._incrementMemory(key)
  }

  /** Clear all recorded attempts for a key (e.g., after successful login). */
  async reset(key: string): Promise<void> {
    if (isRedisConfigured()) {
      try {
        await upstashPipeline([['DEL', this._redisKey(key)]])
      } catch {
        // Fall through to in-memory reset as best-effort
      }
    }
    this.store.delete(key)
  }

  // ─── Redis backend ────────────────────────────────────────────────

  private _redisKey(key: string): string {
    const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs
    return `rl:${this.name}:${key}:${windowStart}`
  }

  private async _hitRedis(key: string): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs
    const windowEnd = windowStart + this.windowMs
    const redisKey = `rl:${this.name}:${key}:${windowStart}`
    const ttlSeconds = Math.ceil(this.windowMs / 1000)

    try {
      const results = await upstashPipeline([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, ttlSeconds, 'NX'],
      ])
      const count = Number(results[0]?.result ?? 0)
      const allowed = count <= this.maxAttempts
      const remaining = Math.max(0, this.maxAttempts - count)
      const retryAfterMs = allowed ? 0 : Math.max(0, windowEnd - now)
      return { allowed, remaining, retryAfterMs }
    } catch {
      // Redis unreachable — fall back to in-memory so we never open the
      // gate entirely on infra failure
      return this._hitMemory(key)
    }
  }

  private async _checkRedis(key: string): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs
    const windowEnd = windowStart + this.windowMs
    const redisKey = `rl:${this.name}:${key}:${windowStart}`

    try {
      const results = await upstashPipeline([['GET', redisKey]])
      const raw = results[0]?.result
      const count = raw == null ? 0 : Number(raw)
      const allowed = count <= this.maxAttempts
      const remaining = Math.max(0, this.maxAttempts - count)
      const retryAfterMs = allowed ? 0 : Math.max(0, windowEnd - now)
      return { allowed, remaining, retryAfterMs }
    } catch {
      return this._checkMemory(key)
    }
  }

  // ─── In-memory fallback (sliding window) ──────────────────────────

  private _hitMemory(key: string): RateLimitResult {
    this._incrementMemory(key)
    return this._checkMemory(key)
  }

  private _checkMemory(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const entry = this.store.get(key)

    if (!entry || entry.timestamps.length === 0) {
      return { allowed: true, remaining: this.maxAttempts, retryAfterMs: 0 }
    }

    const validTimestamps = entry.timestamps.filter((ts) => ts > windowStart)
    entry.timestamps = validTimestamps

    const count = validTimestamps.length
    const allowed = count <= this.maxAttempts
    const remaining = Math.max(0, this.maxAttempts - count)

    let retryAfterMs = 0
    if (!allowed && validTimestamps.length > 0) {
      const oldest = validTimestamps[0]
      retryAfterMs = Math.max(0, oldest + this.windowMs - now)
    }

    return { allowed, remaining, retryAfterMs }
  }

  private _incrementMemory(key: string): void {
    const now = Date.now()
    const entry = this.store.get(key)
    if (entry) {
      entry.timestamps.push(now)
    } else {
      this.store.set(key, { timestamps: [now] })
    }
  }

  private _cleanup(): void {
    const windowStart = Date.now() - this.windowMs
    for (const [key, entry] of this.store.entries()) {
      const valid = entry.timestamps.filter((ts) => ts > windowStart)
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
  name: 'login',
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
})

/** Platform admin login: 5 attempts per minute per IP (strict — cross-org access) */
export const platformLoginRateLimiter = new RateLimiter({
  name: 'platform-login',
  windowMs: 60 * 1000,
  maxAttempts: 5,
})

/** General public API endpoints: 30 requests per minute per IP */
export const publicApiRateLimiter = new RateLimiter({
  name: 'public-api',
  windowMs: 60 * 1000,
  maxAttempts: 30,
})

/** Signup endpoint: 5 registrations per hour per IP */
export const signupRateLimiter = new RateLimiter({
  name: 'signup',
  windowMs: 60 * 60 * 1000,
  maxAttempts: 5,
})

/** Student password endpoints: 10 attempts per minute per IP */
export const studentPasswordRateLimiter = new RateLimiter({
  name: 'student-password',
  windowMs: 60 * 1000,
  maxAttempts: 10,
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
export function getRateLimitHeaders(
  result: Pick<RateLimitResult, 'remaining' | 'retryAfterMs'>
): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
  }
}
