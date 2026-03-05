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
 * It fires prefetch requests for data used across all major pages so that
 * navigating between Dashboard, Calendar, Athletics, and Settings is instant.
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
      // Dashboard
      queryClient.prefetchQuery(queryOptions.tickets()),
      // Calendar
      queryClient.prefetchQuery(queryOptions.calendars()),
      // Auth / permissions
      queryClient.prefetchQuery(queryOptions.permissions()),
      queryClient.prefetchQuery(queryOptions.schoolInfo()),
      // Settings tabs
      queryClient.prefetchQuery(queryOptions.members()),
      queryClient.prefetchQuery(queryOptions.roles()),
      queryClient.prefetchQuery(queryOptions.teams()),
      queryClient.prefetchQuery(queryOptions.settingsPermissions()),
      queryClient.prefetchQuery(queryOptions.campuses()),
      queryClient.prefetchQuery(queryOptions.modules()),
      // Athletics
      queryClient.prefetchQuery(queryOptions.athleticsDashboard()),
      queryClient.prefetchQuery(queryOptions.athleticsSports()),
      queryClient.prefetchQuery(queryOptions.athleticsTeams()),
      queryClient.prefetchQuery(queryOptions.athleticsSeasons()),
      queryClient.prefetchQuery(queryOptions.athleticsTournaments()),
      queryClient.prefetchQuery(queryOptions.athleticsGames()),
      queryClient.prefetchQuery(queryOptions.athleticsPractices()),
      queryClient.prefetchQuery(queryOptions.athleticsRoster()),
    ]

    // Swallow errors — prefetch failures are non-critical
    Promise.allSettled(prefetches).catch(() => {})
  }, [token, queryClient])
}

export default usePrefetchOnAuth
