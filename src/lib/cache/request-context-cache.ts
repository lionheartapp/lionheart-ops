/**
 * Process-local in-memory cache for RequestContext fields that aren't in the JWT.
 *
 * The JWT already carries userId, organizationId, and email — those are immutable
 * within a token lifetime, so they don't need caching. What we cache here is the
 * per-user, per-org state that today forces a DB round-trip on *every* authed API
 * call: roleName, org trialEndsAt, and subscription status.
 *
 * Safety:
 *  - 60s TTL bounds staleness for unhandled update paths.
 *  - Explicit `invalidateUserContext(userId)` on every mutation that changes one
 *    of the cached fields (role change, permission change, subscription change).
 *  - `invalidateAllUserContexts()` for wide changes (role permissions edited, etc.)
 *  - Soft LRU cap (1000 entries) so a huge tenant can't grow the cache unbounded.
 *
 * This cache is process-local. On Vercel each serverless instance has its own
 * copy; that's fine — TTL + explicit invalidation keep each instance honest.
 */

export interface CachedContextFields {
  roleName: string | null
  orgTrialEndsAt: Date | null
  orgSubscriptionStatus: string | null
}

interface Entry {
  value: CachedContextFields
  expires: number
}

const TTL_MS = 60_000
const MAX_ENTRIES = 1000

const cache = new Map<string, Entry>()

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

export function getCachedUserContext(userId: string): CachedContextFields | null {
  const entry = cache.get(userId)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    cache.delete(userId)
    return null
  }
  return entry.value
}

export function setCachedUserContext(userId: string, value: CachedContextFields): void {
  evictIfNeeded()
  cache.set(userId, { value, expires: Date.now() + TTL_MS })
}

/**
 * Invalidate the cached context for a single user.
 * Call this after any mutation that changes their role, permissions, or org
 * subscription/trial state.
 */
export function invalidateUserContext(userId: string): void {
  cache.delete(userId)
}

/**
 * Invalidate *every* cached user context.
 * Call this for changes with wide blast radius — e.g. a role's permissions were
 * edited (affects every user on that role), an org's subscription changed
 * (affects every user in the org). Acceptable because the cache is small,
 * short-lived, and rebuilt on next request.
 */
export function invalidateAllUserContexts(): void {
  cache.clear()
}

/**
 * Invalidate all cached contexts for users in a specific organization.
 * Use when a change affects a whole org (e.g. subscription status changed).
 * Currently implemented as a full clear — optimize with org-indexed storage
 * if we ever see this be a hotspot.
 */
export function invalidateOrgUserContexts(_organizationId: string): void {
  invalidateAllUserContexts()
}
