'use client'

/**
 * useNotificationRealtime — subscribes to Supabase Realtime postgres_changes
 * on the Notification table, filtered to the current user.
 *
 * Invalidates notification query caches so the bell badge and notification
 * list update instantly when new notifications arrive.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { queryKeys } from '@/lib/queries'

export function useNotificationRealtime() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id
  const subscribedRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !userId) return
    if (subscribedRef.current === userId) return
    subscribedRef.current = userId

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Notification',
          filter: `userId=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
        },
      )
      .subscribe()

    return () => {
      subscribedRef.current = null
      channel.unsubscribe()
    }
  }, [queryClient, userId])
}
