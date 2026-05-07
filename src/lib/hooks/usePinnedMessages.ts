'use client'

import { useQuery } from '@tanstack/react-query'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PinnedMessage {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  pinnedAt: string | null
  createdAt: string
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

async function fetchPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const res = await fetch(`/api/messaging/channels/${channelId}/pins`, {
    credentials: 'include',
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.ok ? json.data : []
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePinnedMessages(channelId: string | null) {
  return useQuery<PinnedMessage[]>({
    queryKey: ['messaging', 'pinned-messages', channelId],
    queryFn: () => (channelId ? fetchPinnedMessages(channelId) : Promise.resolve([])),
    enabled: !!channelId,
    staleTime: 15_000,
  })
}
