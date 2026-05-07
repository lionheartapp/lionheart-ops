'use client'

/**
 * useThreadReplies — fetches thread replies for a specific parent message.
 * Uses the same messages endpoint with parentId filter.
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import type { MessageWithAuthor } from '@/lib/services/messageService'

interface ThreadPage {
  messages: MessageWithAuthor[]
  hasMore: boolean
  cursor: string | null
}

interface ApiResponse {
  ok: boolean
  data: MessageWithAuthor[]
  meta?: { hasMore: boolean; cursor: string | null }
}

export function useThreadReplies(channelId: string | null, parentId: string | null) {
  const query = useInfiniteQuery<ThreadPage>({
    queryKey: ['messaging', 'thread', channelId, parentId],
    queryFn: async ({ pageParam }) => {
      const url = new URL(
        `/api/messaging/channels/${channelId}/messages`,
        window.location.origin,
      )
      url.searchParams.set('limit', '50')
      url.searchParams.set('parentId', parentId!)
      if (pageParam) {
        url.searchParams.set('before', pageParam as string)
      }

      const res = await fetch(url.toString(), { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`Failed to fetch thread replies: ${res.status}`)
      }

      const json: ApiResponse = await res.json()
      if (!json.ok) {
        throw new Error('Failed to fetch thread replies')
      }

      return {
        messages: json.data,
        hasMore: json.meta?.hasMore ?? false,
        cursor: json.meta?.cursor ?? null,
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.cursor : undefined,
    enabled: !!channelId && !!parentId,
    staleTime: 15_000,
  })

  // Flatten pages into chronological order (oldest first)
  const replies: MessageWithAuthor[] = query.data
    ? [...query.data.pages].reverse().flatMap((page) => page.messages)
    : []

  return {
    replies,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    error: query.error,
  }
}
