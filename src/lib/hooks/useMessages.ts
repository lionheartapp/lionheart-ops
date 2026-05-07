'use client'

/**
 * useMessages — TanStack Query infinite query for cursor-based message pagination.
 * useMarkChannelRead — mutation to reset unread count when opening a channel.
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { MessageWithAuthor } from '@/lib/services/messageService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessagesPage {
  messages: MessageWithAuthor[]
  hasMore: boolean
  cursor: string | null
}

interface ApiResponse {
  ok: boolean
  data: MessageWithAuthor[]
  meta?: { hasMore: boolean; cursor: string | null }
}

// ---------------------------------------------------------------------------
// useMessages
// ---------------------------------------------------------------------------

export function useMessages(channelId: string | null) {
  const query = useInfiniteQuery<MessagesPage>({
    queryKey: ['messaging', 'messages', channelId],
    queryFn: async ({ pageParam }) => {
      const url = new URL(
        `/api/messaging/channels/${channelId}/messages`,
        window.location.origin,
      )
      url.searchParams.set('limit', '50')
      if (pageParam) {
        url.searchParams.set('before', pageParam as string)
      }

      const res = await fetch(url.toString(), { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`)
      }

      const json: ApiResponse = await res.json()
      if (!json.ok) {
        throw new Error('Failed to fetch messages')
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
    enabled: !!channelId,
    staleTime: 30_000,
  })

  // Flatten all pages into a single chronological array (oldest first).
  // Pages come back newest-first from the API (each page is older than the last),
  // so we reverse the page order and keep each page's internal order.
  const messages: MessageWithAuthor[] = query.data
    ? [...query.data.pages].reverse().flatMap((page) => page.messages)
    : []

  return {
    messages,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    error: query.error,
  }
}

// ---------------------------------------------------------------------------
// useMarkChannelRead
// ---------------------------------------------------------------------------

export function useMarkChannelRead(channelId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!channelId) return
      const res = await fetch(
        `/api/messaging/channels/${channelId}/mark-read`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )
      if (!res.ok) {
        // Non-fatal: mark-read failing shouldn't block messaging
        console.warn('Failed to mark channel as read:', res.status)
      }
    },
    onSuccess: () => {
      // Reset unread count in channel list
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
    },
  })
}
