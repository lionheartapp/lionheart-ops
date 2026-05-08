'use client'

import { useMemo } from 'react'
import { useChannels } from './useChannels'
import { useAuth } from './useAuth'

/**
 * Returns total unread message count across all channels for the current user.
 *
 * The channels API returns ALL members (needed for DM name/avatar display),
 * so we filter to the current user's membership to get accurate counts.
 */
export function useMessagingUnread(): number {
  const { data: channels } = useChannels()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  return useMemo(() => {
    if (!channels?.length || !currentUserId) return 0

    let total = 0
    for (const channel of channels) {
      if (!channel.members) continue
      for (const member of channel.members) {
        if (member.userId === currentUserId) {
          total += member.unreadCount ?? 0
        }
      }
    }
    return total
  }, [channels, currentUserId])
}
