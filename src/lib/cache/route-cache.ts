/**
 * Process-local route-level cache with TTL + tag invalidation.
 *
 * This is the "Shift 2" cache for read-mostly API endpoints. It lives next to
 * `request-context-cache.ts` and follows the same principles:
 *  - Process-local Map (on Vercel, each serverless instance has its own copy)
 *  - TTL bounds staleness for any path we forget to invalidate
 *  - Explicit tag-based invalidation on mutation paths
 *  - Soft LRU cap so a misbehaving caller can't grow the cache unbounded
 *
 * Usage (inside a route handler):
 *
 *   // Org-wide reference data — shared by every user in the org
 *   const schools = await cacheOrgWide(orgId, 'schools:list', () =>
 *     prisma.school.findMany({ where: { deletedAt: null } })
 *   )
 *
 *   // Per-user data — keyed by userId
 *   const notifications = await cachePerUser(ctx.userId, 'notifications:unread', () =>
 *     prisma.notification.findMany({ where: { userId: ctx.userId, read: false } })
 *   )
 *
 * Invalidation (inside the mutation that changed the data):
 *
 *   await prisma.school.create({ data })
 *   invalidateOrgCache(orgId, 'schools')      // blast all schools keys for this org
 *
 *   await prisma.notification.update({ ... })
 *   invalidateUserCache(userId, 'notifications')
 *
 * Safety rules:
 *  - NEVER cache org-scoped data without orgId in the key. Cross-tenant leaks
 *    are catastrophic. `cacheOrgWide` enforces this by requiring orgId.
 *  - NEVER cache per-user data without userId in the key. `cachePerUser`
 *    enforces this.
 *  - Default TTL is short (60s) so even a missed invalidation self-heals.
 *  - Mutations MUST invalidate the buckets they touch. See the invalidate*
 *    helpers below.
 */

interface Entry {
  value: unknown
  expires: number
  /** Sorted, deduplicated tag set for this entry. */
  tags: readonly string[]
}

const TTL_DEFAULT_MS = 60_000
const MAX_ENTRIES = 5000

const cache = new Map<string, Entry>()
const inFlight = new Map<string, Promise<unknown>>()

// Lightweight stats — useful for smoke tests and perf verification.
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
}

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return
  // Simple FIFO eviction — remove oldest 10% of entries.
  const toRemove = Math.ceil(MAX_ENTRIES * 0.1)
  let removed = 0
  for (const key of cache.keys()) {
    cache.delete(key)
    removed += 1
    if (removed >= toRemove) break
  }
}

function isExpired(entry: Entry): boolean {
  return entry.expires < Date.now()
}

// ---------------------------------------------------------------------------
// Core primitive
// ---------------------------------------------------------------------------

interface CacheOptions {
  /** Time-to-live in milliseconds. Defaults to 60s. */
  ttlMs?: number
  /**
   * Tags this entry belongs to. Used by `invalidateCacheTag`. Always include
   * something uniquely identifying the owner (orgId or userId) plus a bucket
   * name describing the resource shape.
   */
  tags: readonly string[]
}

/**
 * Core primitive: run `fetchFn` unless its result is in the cache under `key`.
 *
 * Prefer the scoped helpers (`cacheOrgWide`, `cachePerUser`) over this — they
 * enforce that the owner id is in both the key and the tag set.
 */
export async function cached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const entry = cache.get(key)
  if (entry && !isExpired(entry)) {
    stats.hits += 1
    return entry.value as T
  }
  if (entry) {
    // Expired — drop it so we don't count a stale entry as present.
    cache.delete(key)
  }

  stats.misses += 1
  const active = inFlight.get(key)
  if (active) {
    // Share the same pending work during a traffic burst instead of issuing
    // duplicate database reads for identical cache misses.
    return active as Promise<T>
  }

  const promise = fetchFn()
  inFlight.set(key, promise)

  let value: T
  try {
    value = await promise
  } finally {
    inFlight.delete(key)
  }

  evictIfNeeded()
  cache.set(key, {
    value,
    expires: Date.now() + (options.ttlMs ?? TTL_DEFAULT_MS),
    tags: options.tags,
  })
  stats.sets += 1

  return value
}

// ---------------------------------------------------------------------------
// Scoped helpers
// ---------------------------------------------------------------------------

/**
 * Cache a value that is safe to share across every user inside a single org.
 * Keyed by orgId + bucket name. Typical buckets: 'schools:list', 'roles:list',
 * 'branding', 'school-info'.
 *
 * The bucket name may include a stable suffix for query variants, e.g.
 * `schools:list:campus=${campusId}`. Keep suffixes bounded — unbounded
 * suffixes will fill the cache.
 */
export async function cacheOrgWide<T>(
  orgId: string,
  bucket: string,
  fetchFn: () => Promise<T>,
  options?: { ttlMs?: number; extraTags?: readonly string[] }
): Promise<T> {
  if (!orgId) {
    throw new Error('cacheOrgWide: orgId is required to prevent cross-tenant leaks')
  }
  const key = `org:${orgId}:${bucket}`
  const tags = [`org:${orgId}`, `bucket:${bucket.split(':')[0]}`, ...(options?.extraTags ?? [])]
  return cached(key, fetchFn, {
    ttlMs: options?.ttlMs,
    tags,
  })
}

/**
 * Cache a value that is specific to a single user. Keyed by userId + bucket.
 */
export async function cachePerUser<T>(
  userId: string,
  bucket: string,
  fetchFn: () => Promise<T>,
  options?: { ttlMs?: number; extraTags?: readonly string[] }
): Promise<T> {
  if (!userId) {
    throw new Error('cachePerUser: userId is required to prevent cross-user leaks')
  }
  const key = `user:${userId}:${bucket}`
  const tags = [`user:${userId}`, `bucket:${bucket.split(':')[0]}`, ...(options?.extraTags ?? [])]
  return cached(key, fetchFn, {
    ttlMs: options?.ttlMs,
    tags,
  })
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate every entry that carries `tag`. Tags follow the convention:
 *   - `org:${orgId}`       — all entries owned by an org
 *   - `user:${userId}`     — all entries owned by a user
 *   - `bucket:${bucket}`   — all entries for a resource type (ignores owner)
 */
export function invalidateCacheTag(tag: string): void {
  let removed = 0
  for (const [key, entry] of cache.entries()) {
    if (entry.tags.includes(tag)) {
      cache.delete(key)
      removed += 1
    }
  }
  if (removed > 0) stats.invalidations += removed
}

/**
 * Drop every entry owned by an org. Call after mutations that change
 * org-level data (new school, new role, branding update, etc.).
 *
 * If you know the specific bucket that changed, pass `bucket` to scope the
 * blast radius. Otherwise omits clears everything for the org.
 */
export function invalidateOrgCache(orgId: string, bucket?: string): void {
  if (!orgId) return
  const orgTag = `org:${orgId}`
  if (!bucket) {
    invalidateCacheTag(orgTag)
    return
  }
  const bucketTag = `bucket:${bucket.split(':')[0]}`
  let removed = 0
  for (const [key, entry] of cache.entries()) {
    if (entry.tags.includes(orgTag) && entry.tags.includes(bucketTag)) {
      cache.delete(key)
      removed += 1
    }
  }
  if (removed > 0) stats.invalidations += removed
}

/**
 * Drop every entry owned by a user. Pass `bucket` to scope the blast radius.
 */
export function invalidateUserCache(userId: string, bucket?: string): void {
  if (!userId) return
  const userTag = `user:${userId}`
  if (!bucket) {
    invalidateCacheTag(userTag)
    return
  }
  const bucketTag = `bucket:${bucket.split(':')[0]}`
  let removed = 0
  for (const [key, entry] of cache.entries()) {
    if (entry.tags.includes(userTag) && entry.tags.includes(bucketTag)) {
      cache.delete(key)
      removed += 1
    }
  }
  if (removed > 0) stats.invalidations += removed
}

/**
 * Nuke the entire cache. Use sparingly — only for changes with truly wide
 * blast radius (permission schema changes, deployment-level events).
 */
export function invalidateAllCache(): void {
  stats.invalidations += cache.size
  cache.clear()
  inFlight.clear()
}

// ---------------------------------------------------------------------------
// Introspection (tests / smoke / debug)
// ---------------------------------------------------------------------------

export function getCacheStats(): {
  size: number
  hits: number
  misses: number
  sets: number
  invalidations: number
} {
  return {
    size: cache.size,
    hits: stats.hits,
    misses: stats.misses,
    sets: stats.sets,
    invalidations: stats.invalidations,
  }
}

/**
 * Reset the cache completely — both entries and stats. Only for tests.
 */
export function resetCacheForTests(): void {
  cache.clear()
  inFlight.clear()
  stats.hits = 0
  stats.misses = 0
  stats.sets = 0
  stats.invalidations = 0
}
