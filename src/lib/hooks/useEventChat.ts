'use client'

/**
 * useEventChat — real-time chat for event project collaboration.
 *
 * Strategy:
 *   1. On mount: GET /api/events/projects/{id}/chat for message history
 *   2. Subscribe to Supabase Realtime broadcast channel for instant new messages
 *   3. Fallback: poll GET every 10s if Supabase Realtime unavailable
 *   4. Optimistic send: message appears immediately, POST in background
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/api-client'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export interface ChatMessage {
  id: string
  eventProjectId: string
  userId: string
  userName: string
  userAvatar: string | null
  content: string
  createdAt: string
}

export interface UseEventChatResult {
  messages: ChatMessage[]
  sendMessage: (content: string) => void
  isLoading: boolean
}

const POLL_INTERVAL_MS = 10_000

export function useEventChat(
  eventProjectId: string | null | undefined,
  currentUserId: string | null | undefined,
  currentUserName?: string,
): UseEventChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!eventProjectId) return
    try {
      const data = await fetchApi<ChatMessage[]>(
        `/api/events/projects/${eventProjectId}/chat`,
      )
      setMessages(data)
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false)
    }
  }, [eventProjectId])

  // Send a message — optimistic insert + POST + broadcast
  const sendMessage = useCallback(
    (content: string) => {
      if (!eventProjectId || !currentUserId || !content.trim()) return

      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        eventProjectId,
        userId: currentUserId,
        userName: currentUserName ?? 'You',
        userAvatar: null,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimistic])

      // POST to persist
      fetchApi<ChatMessage>(`/api/events/projects/${eventProjectId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      })
        .then((saved) => {
          // Replace optimistic with persisted
          setMessages((prev) =>
            prev.map((m) => (m.id === optimistic.id ? saved : m)),
          )
          // Broadcast via Supabase Realtime so other tabs get it instantly
          const supabase = getSupabaseBrowserClient()
          if (supabase) {
            supabase
              .channel(`event-chat-${eventProjectId}`)
              .send({
                type: 'broadcast',
                event: 'new-message',
                payload: saved,
              })
              .catch(() => {})
          }
        })
        .catch(() => {
          // Remove optimistic message on failure
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        })
    },
    [eventProjectId, currentUserId, currentUserName],
  )

  useEffect(() => {
    if (!eventProjectId) return

    let cleanedUp = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    // Initial fetch
    fetchMessages()

    // Supabase Realtime broadcast channel for instant message delivery
    const supabase = getSupabaseBrowserClient()
    if (supabase) {
      try {
        const channel = supabase.channel(`event-chat-${eventProjectId}`)
        channel
          .on('broadcast', { event: 'new-message' }, (payload: { payload: ChatMessage }) => {
            if (cleanedUp) return
            const msg = payload.payload
            // Don't duplicate our own optimistic messages
            if (msg.userId === currentUserId) return
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          })
          .subscribe()

        channelRef.current = channel
      } catch {
        // Fall through to polling
      }
    }

    // Polling fallback
    pollTimer = setInterval(() => {
      if (!cleanedUp) fetchMessages()
    }, supabase ? 30_000 : POLL_INTERVAL_MS)

    return () => {
      cleanedUp = true
      if (pollTimer) clearInterval(pollTimer)
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [eventProjectId, currentUserId, fetchMessages])

  return { messages, sendMessage, isLoading }
}
