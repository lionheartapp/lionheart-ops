'use client'

import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, type ComponentProps } from 'react'
import { queryOptions } from '@/lib/queries'

type LinkProps = ComponentProps<typeof Link>

/**
 * Route → prefetch mappings.
 *
 * When the user hovers over a sidebar link for 100ms, we fire prefetchQuery
 * for the data that route will need. This eliminates the loading spinner
 * when navigating between pages.
 */
const ROUTE_PREFETCH_MAP: Record<string, () => Parameters<typeof import('@tanstack/react-query').QueryClient['prefetchQuery']>[0][]> = {
  '/dashboard': () => [
    queryOptions.tickets(),
  ],
  '/calendar': () => [
    queryOptions.calendars(),
  ],
  '/settings': () => [
    queryOptions.permissions(),
    queryOptions.schoolInfo(),
  ],
}

interface PrefetchLinkProps extends LinkProps {
  /** The route path used to look up which queries to prefetch */
  prefetchRoute?: string
}

/**
 * PrefetchLink — A Next.js Link that prefetches TanStack Query data on hover.
 *
 * Drop-in replacement for <Link>. Pass `prefetchRoute` if the href doesn't
 * match a key in ROUTE_PREFETCH_MAP exactly (e.g. dynamic routes).
 *
 * Example:
 *   <PrefetchLink href="/dashboard">Dashboard</PrefetchLink>
 *   <PrefetchLink href="/settings" prefetchRoute="/settings">Settings</PrefetchLink>
 */
export function PrefetchLink({
  prefetchRoute,
  onMouseEnter,
  children,
  ...props
}: PrefetchLinkProps) {
  const queryClient = useQueryClient()
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPrefetched = useRef<Set<string>>(new Set())

  const route = prefetchRoute || (typeof props.href === 'string' ? props.href : '')

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Call original handler if provided
      onMouseEnter?.(e)

      // Don't re-prefetch the same route in this component lifecycle
      if (hasPrefetched.current.has(route)) return

      // Small delay (100ms) to avoid prefetching on accidental hover
      hoverTimer.current = setTimeout(() => {
        const getQueries = ROUTE_PREFETCH_MAP[route]
        if (!getQueries) return

        hasPrefetched.current.add(route)
        const queries = getQueries()
        queries.forEach((opts) => {
          queryClient.prefetchQuery(opts).catch(() => {})
        })
      }, 100)
    },
    [route, queryClient, onMouseEnter]
  )

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  return (
    <Link
      {...props}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Link>
  )
}

export default PrefetchLink
