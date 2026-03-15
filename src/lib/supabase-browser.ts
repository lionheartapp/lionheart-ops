/**
 * Supabase browser-side client for real-time features (e.g., presence channels).
 *
 * Returns null if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are
 * not set — all Realtime consumers must handle the null case gracefully and fall
 * back to polling.
 */

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient

let _client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  if (_client) return _client

  // Lazy-load to avoid including @supabase/supabase-js in all bundles
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js')
    _client = createClient(url, anonKey, {
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
