'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'

/**
 * usePrefetchOnAuth — Warms the TanStack Query cache after sign-in.
 *
 * Call this once in a component that mounts after the user is authenticated
 * (e.g. inside the Providers wrapper or DashboardLayout).
 *
 * It fires prefetch requests for the most common data:
 *  - Tickets (dashboard)
 *  - Calendars (calendar page)
 *  - Permissions (settings access check)
 *  - School info / org logo (settings + header)
 *
 * prefetchQuery will NOT refetch if data already exists and is within staleTime,
 * so calling this multiple times is safe and essentially free.
 */
export function usePrefetchOnAuth(token: string | null) {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  useEffect(() => {
    // Only prefetch once per mount when we have a token
    if (!token || hasPrefetched.current) return
    hasPrefetched.current = true

    // Fire all prefetches in parallel — don't await, let them run in background
    const prefetches = [
      queryClient.prefetchQuery(queryOptions.tickets()),
      queryClient.prefetchQuery(queryOptions.calendars()),
      queryClient.prefetchQuery(queryOptions.permissions()),
      queryClient.prefetchQuery(queryOptions.schoolInfo()),
    ]

    // Swallow errors — prefetch failures are non-critical
    Promise.allSettled(prefetches).catch(() => {})
  }, [token, queryClient])
}

export default usePrefetchOnAuth
