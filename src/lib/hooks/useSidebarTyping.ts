'use client'

/**
 * useSidebarTyping — subscribes to a single org-wide typing topic so the
 * sidebar can show "typing…" beneath each conversation.
 *
 * Topic: `sidebar-typing:{orgId}`
 * Payload: { channelId, userId, displayName }
 *
 * The per-channel useRealtimeChannel hook broadcasts typing to BOTH its
 * own topic (for the chat area) and this org-wide topic (for the sidebar).
 *
 * Returns a Map<channelId, displayName[]> that updates in real time.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRealtime } from '@/components/messaging/RealtimeProvider'
import type { RealtimeChannel } from '@supabase/supabase-js'

const TYPING_CLEAR_MS = 3_000

interface TypingEntry {
  displayName: string
  timer: ReturnType<typeof setTimeout>
}

export function useSidebarTyping(
  orgId: string,
  currentUserId: string,
): Map<string, string[]> {
  const { supabaseClient } = useRealtime()
  const [typingMap, setTypingMap] = useState<Map<string, string[]>>(() => new Map())

  const entriesRef = useRef<Map<string, Map<string, TypingEntry>>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const flush = useCallback(() => {
    const entries = entriesRef.current
    const next = new Map<string, string[]>()
    for (const [chId, users] of entries) {
      if (users.size > 0) {
        next.set(chId, Array.from(users.values()).map((e) => e.displayName))
      }
    }
    setTypingMap(next)
  }, [])

  useEffect(() => {
    if (!supabaseClient || !orgId || !currentUserId) return

    const entries = entriesRef.current
    const topic = `sidebar-typing:${orgId}`
    const channel = supabaseClient.channel(topic)

    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const { channelId, userId, displayName } = payload.payload as {
        channelId: string
        userId: string
        displayName: string
      }
      if (userId === currentUserId) return

      if (!entries.has(channelId)) entries.set(channelId, new Map())
      const channelEntries = entries.get(channelId)!

      // Clear previous timer for this user
      const prev = channelEntries.get(userId)
      if (prev) clearTimeout(prev.timer)

      const timer = setTimeout(() => {
        channelEntries.delete(userId)
        if (channelEntries.size === 0) entries.delete(channelId)
        flush()
      }, TYPING_CLEAR_MS)

      channelEntries.set(userId, { displayName, timer })
      flush()
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      for (const channelEntries of entries.values()) {
        for (const e of channelEntries.values()) clearTimeout(e.timer)
      }
      entries.clear()
    }
  }, [orgId, currentUserId, supabaseClient, flush])

  return typingMap
}
