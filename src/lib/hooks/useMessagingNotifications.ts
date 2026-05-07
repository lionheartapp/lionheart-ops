'use client'

/**
 * useMessagingNotifications — subscribes to a user-specific Supabase Realtime
 * broadcast topic for messaging notifications (D-06).
 *
 * Topic: notif:{orgId}:{userId}
 * Events: messaging_mention, messaging_dm
 *
 * Shows a toast via the provided callback and invalidates the channel list
 * query so unread badges stay accurate.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/components/messaging/RealtimeProvider'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessagingNotification {
  type: 'messaging_mention' | 'messaging_dm'
  channelId: string
  senderName: string
  preview: string
}

interface UseMessagingNotificationsOptions {
  orgId: string
  userId: string
  onNotification: (notification: MessagingNotification) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMessagingNotifications({
  orgId,
  userId,
  onNotification,
}: UseMessagingNotificationsOptions): void {
  const { supabaseClient } = useRealtime()
  const queryClient = useQueryClient()
  const callbackRef = useRef(onNotification)
  callbackRef.current = onNotification

  useEffect(() => {
    if (!supabaseClient || !orgId || !userId) return

    const topic = `notif:${orgId}:${userId}`

    const channel = supabaseClient.channel(topic)

    channel
      .on('broadcast', { event: 'messaging_mention' }, (payload) => {
        const data = payload.payload as {
          channelId: string
          senderName: string
          preview: string
        }
        callbackRef.current({
          type: 'messaging_mention',
          channelId: data.channelId,
          senderName: data.senderName,
          preview: data.preview,
        })
        queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      })
      .on('broadcast', { event: 'messaging_dm' }, (payload) => {
        const data = payload.payload as {
          channelId: string
          senderName: string
          preview: string
        }
        callbackRef.current({
          type: 'messaging_dm',
          channelId: data.channelId,
          senderName: data.senderName,
          preview: data.preview,
        })
        queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      })
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [supabaseClient, orgId, userId, queryClient])
}
