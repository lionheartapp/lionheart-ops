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
 * F-010: trimmed aggressively. Previously this fired 18 prefetches on every
 * authenticated mount — including the entire Athletics module (8 endpoints)
 * and every Settings tab data source — regardless of which page the user
 * was actually navigating to. That added ~25 of the 34 API calls observed
 * on the dashboard's first paint.
 *
 * Now: only prefetch the cross-cutting data that's used by virtually every
 * authenticated route (current user permissions, tickets, calendars,
 * school info, modules). Pages that need Athletics, Settings sub-data,
 * etc. fetch on mount via their own hooks — TanStack Query's staleTime
 * + the AuthBridge's primed module cache keeps things instant after the
 * first visit anyway.
 *
 * prefetchQuery will NOT refetch if data already exists and is within
 * staleTime, so calling this multiple times is safe and essentially free.
 */
export function usePrefetchOnAuth(token: string | null) {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  useEffect(() => {
    // Only prefetch once per mount when we have a token
    if (!token || hasPrefetched.current) return
    hasPrefetched.current = true

    // Cross-cutting data only — used by most authenticated pages.
    // Fire in parallel; don't await, let them run in the background.
    const prefetches = [
      queryClient.prefetchQuery(queryOptions.tickets()),
      queryClient.prefetchQuery(queryOptions.calendars()),
      queryClient.prefetchQuery(queryOptions.permissions()),
      queryClient.prefetchQuery(queryOptions.schoolInfo()),
      queryClient.prefetchQuery(queryOptions.modules()),
    ]

    // Swallow errors — prefetch failures are non-critical
    Promise.allSettled(prefetches).catch(() => {})
  }, [token, queryClient])
}

export default usePrefetchOnAuth
