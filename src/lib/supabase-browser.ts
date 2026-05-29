/**
 * Supabase browser-side client for real-time features (e.g., presence channels).
 *
 * Returns null if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are
 * not set — all Realtime consumers must handle the null case gracefully and fall
 * back to polling.
 */

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient

let _client: SupabaseClient | null = null
let _accessToken: string | null = null

async function getRealtimeAccessToken(anonKey: string): Promise<string> {
  try {
    const res = await fetch('/api/auth/token', { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.ok && json.data?.token) {
      const token = String(json.data.token)
      _accessToken = token
      return token
    }
  } catch {
    // Realtime is best-effort. Fall back to the anonymous key below.
  }

  return _accessToken ?? anonKey
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED !== 'true') return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  if (_client) return _client

  // Lazy-load to avoid including @supabase/supabase-js in all bundles
  try {
    // eslint-disable-next-line
    const { createClient } = require('@supabase/supabase-js')
    _client = createClient(url, anonKey, {
      accessToken: () => getRealtimeAccessToken(anonKey),
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
    return _client
  } catch {
    // @supabase/supabase-js not installed — gracefully return null
    return null
  }
}
