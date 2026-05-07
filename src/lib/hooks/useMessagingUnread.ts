'use client'

import { useMemo } from 'react'
import { useChannels } from './useChannels'

/**
 * Returns total unread message count across all channels for the current user.
 *
 * Derives the count from the channel list data (which includes per-member
 * unreadCount), so no extra API call is needed.
 */
export function useMessagingUnread(): number {
  const { data: channels } = useChannels()

  return useMemo(() => {
    if (!channels?.length) return 0

    let total = 0
    for (const channel of channels) {
      if (!channel.members) continue
      for (const member of channel.members) {
        // The API returns only the current user's membership when listing channels,
        // so every member entry here belongs to the current user.
        total += member.unreadCount ?? 0
      }
    }
    return total
  }, [channels])
}
