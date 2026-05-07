'use client'

import { useQuery } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────────────────────

interface ShapedMember {
  id: string
  channelId: string
  userId: string
  role: string
  unreadCount: number
  lastReadAt: string | null
  mutedAt: string | null
  createdAt: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    avatar: string | null
  }
}

export interface ShapedChannel {
  id: string
  name: string
  slug: string
  type: string // 'PUBLIC' | 'PRIVATE' | 'DM' | 'GROUP_DM'
  description: string | null
  topic: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  memberCount: number
  members?: ShapedMember[]
  lastMessage: {
    id: string
    content: string
    authorId: string
    createdAt: string
  } | null
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchChannels(): Promise<ShapedChannel[]> {
  const res = await fetch('/api/messaging/channels', {
    credentials: 'include',
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.ok ? json.data : []
}

async function fetchChannel(channelId: string): Promise<ShapedChannel | null> {
  const res = await fetch(`/api/messaging/channels/${channelId}`, {
    credentials: 'include',
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.ok ? json.data : null
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useChannels() {
  return useQuery<ShapedChannel[]>({
    queryKey: ['messaging', 'channels'],
    queryFn: fetchChannels,
    staleTime: 30_000,
  })
}

export function useChannel(channelId: string | null) {
  return useQuery<ShapedChannel | null>({
    queryKey: ['messaging', 'channels', channelId],
    queryFn: () => (channelId ? fetchChannel(channelId) : Promise.resolve(null)),
    enabled: !!channelId,
    staleTime: 30_000,
  })
}
