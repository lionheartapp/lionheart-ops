'use client'

/**
 * useMessageSearch -- TanStack Query infinite-query hook for full-text
 * message search via GET /api/messaging/search.
 *
 * Debounces the raw query string by 300ms before triggering a fetch.
 * Requires at least 2 characters to fire.
 */

import { useState, useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// ---------------------------------------------------------------------------
// Types (mirror SearchResult from messageService)
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string
  channelId: string
  channelName: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  createdAt: string
}

interface SearchPage {
  results: SearchResult[]
  hasMore: boolean
  cursor: string | null
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchSearchPage(
  query: string,
  channelId: string | undefined,
  cursor: string | undefined,
): Promise<SearchPage> {
  const params = new URLSearchParams({ q: query, limit: '20' })
  if (channelId) params.set('channelId', channelId)
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(`/api/messaging/search?${params.toString()}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error('Search request failed')
  }

  const json = await res.json()
  if (!json.ok) {
    throw new Error(json.error?.message ?? 'Search failed')
  }

  return {
    results: json.data ?? [],
    hasMore: json.meta?.hasMore ?? false,
    cursor: json.meta?.cursor ?? null,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMessageSearch(query: string, channelId?: string) {
  const debouncedQuery = useDebounce(query.trim(), 300)
  const enabled = debouncedQuery.length >= 2

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['message-search', debouncedQuery, channelId],
    queryFn: ({ pageParam }) =>
      fetchSearchPage(debouncedQuery, channelId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.cursor : undefined,
    enabled,
  })

  // Flatten all pages into a single results array
  const results: SearchResult[] = data?.pages.flatMap((p) => p.results) ?? []
  const hasMore = hasNextPage ?? false

  return {
    results,
    hasMore,
    fetchNextPage,
    isLoading: enabled && isLoading,
    isFetchingNextPage,
    debouncedQuery,
  }
}
