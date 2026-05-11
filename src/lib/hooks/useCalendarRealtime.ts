'use client'

/**
 * useCalendarRealtime — subscribes to Supabase Realtime postgres_changes
 * on the CalendarEvent table, scoped to the user's organization.
 *
 * When any INSERT, UPDATE, or DELETE happens for this org, it invalidates
 * the TanStack Query cache so the calendar refreshes instantly for all
 * users without a page reload.
 *
 * Falls back gracefully to no-op if Supabase Realtime is not configured.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export function useCalendarRealtime() {
  const queryClient = useQueryClient()
  const { orgId } = useAuth()
  const subscribedRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !orgId) return

    // Already subscribed to this org
    if (subscribedRef.current === orgId) return
    subscribedRef.current = orgId

    const channel = supabase
      .channel(`calendar-changes:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'CalendarEvent',
          filter: `organizationId=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
        },
      )
      .subscribe()

    return () => {
      subscribedRef.current = null
      channel.unsubscribe()
    }
  }, [queryClient, orgId])
}
