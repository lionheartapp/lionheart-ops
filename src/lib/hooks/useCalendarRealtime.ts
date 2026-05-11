'use client'

/**
 * useCalendarRealtime — subscribes to Supabase Realtime postgres_changes
 * on the CalendarEvent table. When any INSERT, UPDATE, or DELETE happens,
 * it invalidates the TanStack Query cache so the calendar refreshes instantly
 * for all users without a page reload.
 *
 * Falls back gracefully to no-op if Supabase Realtime is not configured.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export function useCalendarRealtime() {
  const queryClient = useQueryClient()
  const subscribedRef = useRef(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || subscribedRef.current) return

    subscribedRef.current = true

    const channel = supabase
      .channel('calendar-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'CalendarEvent' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
        },
      )
      .subscribe()

    return () => {
      subscribedRef.current = false
      channel.unsubscribe()
    }
  }, [queryClient])
}
