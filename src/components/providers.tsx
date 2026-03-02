'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { usePrefetchOnAuth } from '@/lib/hooks/usePrefetchOnAuth'

function PrefetchGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem('auth-token'))
  }, [])

  // Warm the TanStack Query cache as soon as we know the user is authed
  usePrefetchOnAuth(token)

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ── Key change: bump staleTime from 15s → 5 minutes ──
            // School data (rosters, calendars, settings) doesn't change
            // every 15 seconds. This prevents unnecessary background
            // refetches when navigating between pages and is the single
            // biggest win for perceived performance.
            staleTime: 5 * 60 * 1000, // 5 minutes

            // Keep unused data in memory for 30 minutes before GC.
            // Users often navigate away and come back within a session.
            gcTime: 30 * 60 * 1000, // 30 minutes

            // Still refetch when user returns to the tab — keeps data
            // fresh after they've been away
            refetchOnWindowFocus: true,

            // Don't refetch when the component remounts (e.g. navigating
            // back). Combined with staleTime this means instant page loads.
            refetchOnMount: false,

            // Retry once on failure, then show error
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <PrefetchGate>{children}</PrefetchGate>
    </QueryClientProvider>
  )
}
