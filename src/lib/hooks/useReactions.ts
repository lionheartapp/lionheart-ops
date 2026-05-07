'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReactionGroup {
  emoji: string
  count: number
  reacted: boolean
}

interface ToggleResult {
  action: 'added' | 'removed'
  emoji: string
}

interface ApiReactionGroup {
  emoji: string
  count: number
  userIds: string[]
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

async function fetchReactions(
  messageIds: string[],
): Promise<Record<string, ApiReactionGroup[]>> {
  if (messageIds.length === 0) return {}
  const params = new URLSearchParams()
  messageIds.forEach((id) => params.append('messageId', id))
  const res = await fetch(`/api/messaging/reactions?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) return {}
  const json = await res.json()
  return json.ok ? json.data : {}
}

async function postToggleReaction(
  messageId: string,
  emoji: string,
): Promise<ToggleResult> {
  const res = await fetch(`/api/messaging/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ emoji }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Failed to toggle reaction')
  }
  const json = await res.json()
  return json.data as ToggleResult
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Batch-fetch reactions for a set of message IDs.
 * Returns a map of messageId -> ReactionGroup[] with `reacted` based on currentUserId.
 */
export function useReactions(channelId: string, messageIds: string[], currentUserId: string | null) {
  const sortedIds = [...messageIds].sort()
  const queryKey = ['messaging', 'reactions', channelId, sortedIds.join(',')]

  const query = useQuery<Record<string, ReactionGroup[]>>({
    queryKey,
    queryFn: async () => {
      const raw = await fetchReactions(sortedIds)
      const result: Record<string, ReactionGroup[]> = {}
      for (const [msgId, groups] of Object.entries(raw)) {
        result[msgId] = groups.map((g) => ({
          emoji: g.emoji,
          count: g.count,
          reacted: currentUserId ? g.userIds.includes(currentUserId) : false,
        }))
      }
      return result
    },
    enabled: sortedIds.length > 0,
    staleTime: 10_000,
  })

  return query
}

/**
 * Toggle a reaction on a message with optimistic update.
 */
export function useToggleReaction(channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      postToggleReaction(messageId, emoji),
    onSettled: () => {
      // Invalidate all reaction queries for this channel
      queryClient.invalidateQueries({
        queryKey: ['messaging', 'reactions', channelId],
      })
    },
  })
}
