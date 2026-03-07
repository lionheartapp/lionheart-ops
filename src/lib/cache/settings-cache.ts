/**
 * Settings Data Cache
 *
 * In-memory TTL cache for rarely-changing settings data:
 * roles, permissions, campus/buildings, schools, teams.
 *
 * Cache key format: `{orgId}:{dataType}` or `{dataType}` for global data.
 * TTL: 5 minutes (configurable per entry type).
 *
 * Invalidation: call `invalidateSettingsCache(orgId, dataType)` after
 * any mutation (POST/PUT/DELETE) on the cached resource.
 */

interface CacheEntry<T = unknown> {
  data: T
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get a cached value, or fetch and cache it.
 *
 * @param key - Cache key (e.g., `org-123:roles`)
 * @param fetcher - Async function to fetch the data if not cached
 * @param ttl - Time-to-live in ms (default: 5 minutes)
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return cached.data as T
  }

  const data = await fetcher()
  cache.set(key, { data, fetchedAt: Date.now() })
  return data
}

/**
 * Invalidate a specific cache entry.
 */
export function invalidateSettingsCache(key: string): void {
  cache.delete(key)
}

/**
 * Invalidate all cache entries for an organization.
 */
export function invalidateOrgCache(orgId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${orgId}:`)) {
      cache.delete(key)
    }
  }
}

/**
 * Invalidate all cache entries of a specific type across all orgs.
 */
export function invalidateCacheByType(dataType: string): void {
  for (const key of cache.keys()) {
    if (key.endsWith(`:${dataType}`)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearSettingsCache(): void {
  cache.clear()
}

// --- Helper key builders ---

export function settingsCacheKey(orgId: string, dataType: string): string {
  return `${orgId}:${dataType}`
}

export function globalCacheKey(dataType: string): string {
  return `global:${dataType}`
}
