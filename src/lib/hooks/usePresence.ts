'use client'

/**
 * usePresence — tracks who else is currently viewing this event project.
 *
 * Strategy:
 *   1. On mount: POST heartbeat to /api/events/projects/{id}/presence
 *   2. Every 30s: POST another heartbeat (keeps session alive)
 *   3. On unmount: DELETE session
 *   4. If NEXT_PUBLIC_SUPABASE_URL is set: also subscribe to Supabase Realtime
 *      presence channel for instant updates.
 *   5. Fallback: if Supabase Realtime is unavailable, poll GET /presence every 15s.
 *
 * Returns: { activeUsers } — list of users currently active on this project.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchApi } from '@/lib/api-client'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { EventPresenceSessionWithUser } from '@/lib/types/events-phase21'

export interface ActiveUser {
  userId: string
  name: string
  avatarUrl: string | null
  activeTab: string | null
}

export interface UsePresenceResult {
  activeUsers: ActiveUser[]
}

const HEARTBEAT_INTERVAL_MS = 30_000
const POLL_INTERVAL_MS = 15_000

function shapeSession(session: EventPresenceSessionWithUser): ActiveUser {
  return {
    userId: session.userId,
    name: session.userName,
    avatarUrl: session.userAvatar,
    activeTab: session.activeTab,
  }
}

export function usePresence(
  eventProjectId: string | null | undefined,
  userId: string | null | undefined,
  activeTab?: string,
): UsePresenceResult {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])

  // Keep activeTab in a ref so the heartbeat always sends the current value
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  const fetchActiveUsers = useCallback(async () => {
    if (!eventProjectId) return
    try {
      const users = await fetchApi<EventPresenceSessionWithUser[]>(
        `/api/events/projects/${eventProjectId}/presence`,
      )
      setActiveUsers(users.map(shapeSession))
    } catch {
      // Non-fatal: presence polling errors are swallowed silently
    }
  }, [eventProjectId])

  const sendHeartbeat = useCallback(async () => {
    if (!eventProjectId || !userId) return
    try {
      await fetchApi(`/api/events/projects/${eventProjectId}/presence`, {
        method: 'POST',
        body: JSON.stringify({ activeTab: activeTabRef.current }),
      })
    } catch {
      // Non-fatal
    }
  }, [eventProjectId, userId])

  const removePresence = useCallback(async () => {
    if (!eventProjectId || !userId) return
    try {
      await fetchApi(`/api/events/projects/${eventProjectId}/presence`, {
        method: 'DELETE',
      })
    } catch {
      // Non-fatal
    }
  }, [eventProjectId, userId])

  useEffect(() => {
    if (!eventProjectId || !userId) return

    let cleanedUp = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let realtimeChannel: { unsubscribe: () => void } | null = null

    // Initial heartbeat + presence fetch
    sendHeartbeat().then(() => fetchActiveUsers())

    // Heartbeat interval (keep session alive)
    heartbeatTimer = setInterval(() => {
      if (!cleanedUp) sendHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    // Try Supabase Realtime for instant updates
    const supabase = getSupabaseBrowserClient()

    if (supabase) {
      try {
        const channel = supabase.channel(`event-presence-${eventProjectId}`)

        channel
          .on('presence', { event: 'sync' }, () => {
            // On Supabase presence sync, refresh from our DB endpoint
            // (Supabase presence only gives us client-side track data,
            //  not the full user profile info stored in our DB)
            if (!cleanedUp) fetchActiveUsers()
          })
          .on('presence', { event: 'join' }, () => {
            if (!cleanedUp) fetchActiveUsers()
          })
          .on('presence', { event: 'leave' }, () => {
            if (!cleanedUp) fetchActiveUsers()
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              // Track our own presence in the Supabase channel
              channel.track({ userId, activeTab: activeTabRef.current }).catch(() => {})
            }
          })

        realtimeChannel = channel
      } catch {
        // Supabase subscription failed — fall through to polling
      }
    }

    // Always set up DB polling as backup (or primary if no Supabase)
    pollTimer = setInterval(() => {
      if (!cleanedUp) fetchActiveUsers()
    }, supabase ? HEARTBEAT_INTERVAL_MS : POLL_INTERVAL_MS)

    return () => {
      cleanedUp = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (pollTimer) clearInterval(pollTimer)
      if (realtimeChannel) realtimeChannel.unsubscribe()
      removePresence()
    }
  }, [eventProjectId, userId, sendHeartbeat, fetchActiveUsers, removePresence])

  return { activeUsers }
}
