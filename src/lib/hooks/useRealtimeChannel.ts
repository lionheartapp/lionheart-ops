'use client'

/**
 * useRealtimeChannel — subscribes to broadcast messages, typing indicators,
 * and presence for a single messaging channel (D-04).
 *
 * Topic pattern: msg:{orgId}:{channelId} (D-05)
 * Event types: new_message (D-06), typing (D-09), presence (D-08)
 *
 * Consumers call this hook per-channel. It handles subscribe/unsubscribe on
 * channelId changes and full cleanup on unmount.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtime } from '@/components/messaging/RealtimeProvider'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TypingUser {
  userId: string
  displayName: string
}

export interface UseRealtimeChannelOptions {
  channelId: string | null
  orgId: string
  currentUserId: string
  currentDisplayName: string
}

export interface UseRealtimeChannelResult {
  /** Latest broadcast message — consumers append to their own list. */
  incomingMessage: BroadcastMessage | null
  typingUsers: TypingUser[]
  presenceState: Map<string, 'online' | 'away' | 'offline'>
  isConnected: boolean
  error: string | null
  sendTypingIndicator: () => void
}

/** Shape of a broadcast new_message payload (from Postgres trigger row_to_json). */
export interface BroadcastMessage {
  id: string
  channelId: string
  authorId: string
  content: string
  createdAt: string
  organizationId: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPING_BROADCAST_DEBOUNCE_MS = 3_000
const TYPING_CLEAR_TIMEOUT_MS = 3_000
const HEARTBEAT_INTERVAL_MS = 60_000
const AWAY_THRESHOLD_MS = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRealtimeChannel(
  options: UseRealtimeChannelOptions,
): UseRealtimeChannelResult {
  const { channelId, orgId, currentUserId, currentDisplayName } = options
  const { supabaseClient, isConnected: providerConnected } = useRealtime()

  const [incomingMessage, setIncomingMessage] = useState<BroadcastMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [presenceState, setPresenceState] = useState<Map<string, 'online' | 'away' | 'offline'>>(
    () => new Map(),
  )
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const cleanedUpRef = useRef(false)
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastTypingSentRef = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef(Date.now())

  // -----------------------------------------------------------------------
  // sendTypingIndicator — debounced to once every 3 seconds (D-10)
  // -----------------------------------------------------------------------
  const sendTypingIndicator = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_BROADCAST_DEBOUNCE_MS) return
    if (!channelRef.current) return

    lastTypingSentRef.current = now
    lastActivityRef.current = now

    channelRef.current
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, displayName: currentDisplayName },
      })
      .catch(() => {
        // Non-fatal: typing is ephemeral
      })
  }, [currentUserId, currentDisplayName])

  // -----------------------------------------------------------------------
  // Channel subscription effect
  // -----------------------------------------------------------------------
  useEffect(() => {
    cleanedUpRef.current = false

    // Guard: no client or no channel
    if (!supabaseClient) {
      if (channelId) {
        setError('Realtime not available')
      }
      return
    }

    if (!channelId) {
      setIsConnected(false)
      return
    }

    // Clear state from previous channel
    setIncomingMessage(null)
    setTypingUsers([])
    setPresenceState(new Map())
    setError(null)

    const topic = `msg:${orgId}:${channelId}`

    // ------------------------------------------------------------------
    // Build channel with broadcast + presence listeners
    // ------------------------------------------------------------------
    const channel = supabaseClient.channel(topic)

    // Broadcast: new_message (D-06)
    channel.on('broadcast', { event: 'new_message' }, (payload) => {
      if (cleanedUpRef.current) return
      const msg = payload.payload as BroadcastMessage
      // Skip own messages — optimistic sends handled by the composer
      if (msg.authorId === currentUserId) return
      setIncomingMessage(msg)
    })

    // Broadcast: typing (D-09)
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (cleanedUpRef.current) return
      const { userId, displayName } = payload.payload as TypingUser
      // Filter out self
      if (userId === currentUserId) return

      // Add/update typing user
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId)
        return [...filtered, { userId, displayName }]
      })

      // Clear after 3 seconds of no typing from this user
      const existing = typingTimeoutsRef.current.get(userId)
      if (existing) clearTimeout(existing)

      typingTimeoutsRef.current.set(
        userId,
        setTimeout(() => {
          if (cleanedUpRef.current) return
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId))
          typingTimeoutsRef.current.delete(userId)
        }, TYPING_CLEAR_TIMEOUT_MS),
      )
    })

    // Presence: sync/join/leave (D-08)
    channel.on('presence', { event: 'sync' }, () => {
      if (cleanedUpRef.current) return
      const state = channel.presenceState<{
        userId: string
        status: 'online' | 'away'
        lastActive: number
      }>()

      const newMap = new Map<string, 'online' | 'away' | 'offline'>()
      const now = Date.now()

      for (const key of Object.keys(state)) {
        const presences = state[key]
        if (!presences || presences.length === 0) continue
        // Use the first (most recent) presence entry
        const p = presences[0]
        const userId = p.userId
        if (!userId) continue

        if (now - p.lastActive >= AWAY_THRESHOLD_MS) {
          newMap.set(userId, 'away')
        } else {
          newMap.set(userId, p.status === 'away' ? 'away' : 'online')
        }
      }

      setPresenceState(newMap)
    })

    // Subscribe and track presence
    channel.subscribe((status) => {
      if (cleanedUpRef.current) return

      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        setError(null)

        // Track own presence
        channel
          .track({
            userId: currentUserId,
            status: 'online' as const,
            lastActive: Date.now(),
          })
          .catch(() => {
            // Non-fatal
          })
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false)
        setError('Channel subscription failed')
      } else if (status === 'TIMED_OUT') {
        setIsConnected(false)
        setError('Channel subscription timed out')
      }
    })

    channelRef.current = channel

    // ------------------------------------------------------------------
    // Heartbeat: update lastActive every 60s for away detection
    // ------------------------------------------------------------------
    heartbeatRef.current = setInterval(() => {
      if (cleanedUpRef.current || !channelRef.current) return

      const now = Date.now()
      const status = now - lastActivityRef.current >= AWAY_THRESHOLD_MS ? 'away' : 'online'

      channelRef.current
        .track({
          userId: currentUserId,
          status,
          lastActive: lastActivityRef.current,
        })
        .catch(() => {
          // Non-fatal
        })
    }, HEARTBEAT_INTERVAL_MS)

    // ------------------------------------------------------------------
    // User activity listener — reset lastActive on interaction
    // ------------------------------------------------------------------
    function handleActivity() {
      lastActivityRef.current = Date.now()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleActivity)
      window.addEventListener('mousemove', handleActivity)
      window.addEventListener('click', handleActivity)
    }

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------
    return () => {
      cleanedUpRef.current = true

      // Unsubscribe from channel
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }

      // Clear typing timeouts
      for (const timer of typingTimeoutsRef.current.values()) {
        clearTimeout(timer)
      }
      typingTimeoutsRef.current.clear()

      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }

      // Remove activity listeners
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleActivity)
        window.removeEventListener('mousemove', handleActivity)
        window.removeEventListener('click', handleActivity)
      }

      setIsConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, orgId, currentUserId, supabaseClient])

  return {
    incomingMessage,
    typingUsers,
    presenceState,
    isConnected: isConnected && providerConnected,
    error,
    sendTypingIndicator,
  }
}
