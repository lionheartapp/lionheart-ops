/**
 * Local cache for app bootstrap data with 5-minute TTL
 * Speeds up page reloads and navigation between tabs
 */

const CACHE_KEY = 'lionheart_bootstrap_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedData {
  user: any
  tickets: any[]
  events: any[]
  org?: any
  timestamp: number
}

export function getCachedBootstrap(): CachedData | null {
  try {
    if (typeof window === 'undefined') return null
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached) as CachedData
    // Check if cache is still valid (5 minute TTL)
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setCachedBootstrap(data: CachedData) {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }))
  } catch {
    // Fail silently if localStorage is full or unavailable
  }
}

export function clearBootstrapCache() {
  try {
    if (typeof window === 'undefined') return
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Fail silently
  }
}
