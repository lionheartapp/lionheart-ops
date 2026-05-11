'use client'

/**
 * useEventProjectRealtime — subscribes to Supabase Realtime postgres_changes
 * on the EventProject table, scoped to the user's organization.
 *
 * Invalidates event project query caches so the events hub and detail pages
 * update instantly when projects are created, updated, or approved.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export function useEventProjectRealtime() {
  const queryClient = useQueryClient()
  const { orgId } = useAuth()
  const subscribedRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !orgId) return
    if (subscribedRef.current === orgId) return
    subscribedRef.current = orgId

    const channel = supabase
      .channel(`event-projects:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'EventProject',
          filter: `organizationId=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event-projects'] })
          queryClient.invalidateQueries({ queryKey: ['event-project'] })
        },
      )
      .subscribe()

    return () => {
      subscribedRef.current = null
      channel.unsubscribe()
    }
  }, [queryClient, orgId])
}
