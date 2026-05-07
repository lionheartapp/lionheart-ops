'use client'

/**
 * RealtimeProvider — React context that creates a Supabase client authenticated
 * with the custom JWT from /api/auth/token (D-03).
 *
 * This provider creates its OWN Supabase client with an accessToken callback.
 * Do NOT use getSupabaseBrowserClient() here — that uses the anon key without
 * accessToken and is intended for non-messaging Realtime features.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface RealtimeContextValue {
  supabaseClient: SupabaseClient | null
  isConnected: boolean
  connectionError: string | null
}

const RealtimeContext = createContext<RealtimeContextValue>({
  supabaseClient: null,
  isConnected: false,
  connectionError: null,
})

/**
 * Consumer hook — call from any component inside <RealtimeProvider>.
 */
export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext)
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

interface TokenResponse {
  ok: true
  data: { token: string; expiresAt: number | null }
}

async function fetchToken(): Promise<{ token: string; expiresAt: number | null }> {
  const res = await fetch('/api/auth/token', { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Token fetch failed (${res.status})`)
  }
  const json: TokenResponse = await res.json()
  if (!json.ok) {
    throw new Error('Token response not ok')
  }
  return json.data
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const REFRESH_MARGIN_MS = 5 * 60 * 1000 // 5 minutes before expiry
const MAX_BACKOFF_MS = 30_000
const MAX_RETRY_FAILURES = 3

interface Props {
  children: ReactNode
}

export function RealtimeProvider({ children }: Props) {
  const clientRef = useRef<SupabaseClient | null>(null)
  const tokenRef = useRef<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanedUpRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)

  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  // Bump to force context re-render when client is ready
  const [clientReady, setClientReady] = useState(false)

  useEffect(() => {
    cleanedUpRef.current = false

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      setConnectionError(
        'Realtime unavailable: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured',
      )
      return
    }

    // ------------------------------------------------------------------
    // Schedule a token refresh before expiry
    // ------------------------------------------------------------------
    function scheduleRefresh(expiresAt: number | null) {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }

      if (!expiresAt) return

      const expiresMs = expiresAt * 1000
      const refreshIn = Math.max(expiresMs - Date.now() - REFRESH_MARGIN_MS, 10_000)

      refreshTimerRef.current = setTimeout(() => {
        if (cleanedUpRef.current) return
        refreshTokenWithBackoff(0)
      }, refreshIn)
    }

    // ------------------------------------------------------------------
    // Retry with exponential backoff
    // ------------------------------------------------------------------
    function refreshTokenWithBackoff(attempt: number) {
      if (cleanedUpRef.current) return

      fetchToken()
        .then(({ token, expiresAt }) => {
          if (cleanedUpRef.current) return
          tokenRef.current = token
          consecutiveFailuresRef.current = 0
          scheduleRefresh(expiresAt)
        })
        .catch(() => {
          if (cleanedUpRef.current) return
          consecutiveFailuresRef.current += 1

          if (consecutiveFailuresRef.current >= MAX_RETRY_FAILURES) {
            setConnectionError('Realtime token refresh failed after multiple retries')
            return
          }

          const delay = Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS)
          refreshTimerRef.current = setTimeout(() => {
            refreshTokenWithBackoff(attempt + 1)
          }, delay)
        })
    }

    // ------------------------------------------------------------------
    // Bootstrap: fetch initial token and create client
    // ------------------------------------------------------------------
    async function init() {
      try {
        const { token, expiresAt } = await fetchToken()
        if (cleanedUpRef.current) return

        tokenRef.current = token

        // Dynamic import to keep @supabase/supabase-js out of bundles that
        // don't render <RealtimeProvider>.
        const { createClient } = await import('@supabase/supabase-js')

        const client = createClient(supabaseUrl, supabaseAnonKey, {
          realtime: {
            params: { eventsPerSecond: 10 },
            accessToken: async () => {
              // Return the latest token — refreshed in the background
              return tokenRef.current ?? ''
            },
          },
        })

        if (cleanedUpRef.current) return

        clientRef.current = client
        setIsConnected(true)
        setConnectionError(null)
        setClientReady(true)

        // Schedule the first refresh
        scheduleRefresh(expiresAt)
      } catch (err: unknown) {
        if (cleanedUpRef.current) return
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setConnectionError(`Realtime connection failed: ${msg}`)
        setIsConnected(false)
      }
    }

    init()

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------
    return () => {
      cleanedUpRef.current = true

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }

      if (clientRef.current) {
        clientRef.current.removeAllChannels()
        clientRef.current = null
      }
    }
  }, [])

  // The context value uses clientRef.current directly — clientReady triggers
  // re-render so consumers get the non-null client after init completes.
  void clientReady

  return (
    <RealtimeContext.Provider
      value={{
        supabaseClient: clientRef.current,
        isConnected,
        connectionError,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}
