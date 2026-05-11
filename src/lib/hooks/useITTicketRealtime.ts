'use client'

/**
 * useITTicketRealtime — subscribes to Supabase Realtime postgres_changes
 * on the ITTicket table, scoped to the user's organization.
 *
 * Invalidates IT ticket query caches so board/list views update instantly.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { queryKeys } from '@/lib/queries'

export function useITTicketRealtime() {
  const queryClient = useQueryClient()
  const { orgId } = useAuth()
  const subscribedRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !orgId) return
    if (subscribedRef.current === orgId) return
    subscribedRef.current = orgId

    const channel = supabase
      .channel(`it-tickets:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ITTicket',
          filter: `organizationId=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
          queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
          queryClient.invalidateQueries({ queryKey: queryKeys.itDashboard.all })
        },
      )
      .subscribe()

    return () => {
      subscribedRef.current = null
      channel.unsubscribe()
    }
  }, [queryClient, orgId])
}
