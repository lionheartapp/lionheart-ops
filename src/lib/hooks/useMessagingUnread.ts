'use client'

import { useEffect, useMemo, useState } from 'react'
import { useChannels } from './useChannels'
import { useAuth } from './useAuth'

/**
 * Returns total unread message count across all channels for the current user.
 *
 * The channels API returns ALL members (needed for DM name/avatar display),
 * so we filter to the current user's membership to get accurate counts.
 */
export function useMessagingUnread(): number {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setEnabled(true), 10_000)
    return () => window.clearTimeout(timeout)
  }, [])

  const { data: channels } = useChannels({ enabled })
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
