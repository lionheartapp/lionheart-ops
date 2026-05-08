'use client'

/**
 * ThreadPanel -- slide-in panel for threaded message replies.
 *
 * Shows the parent message at top, thread replies below, and a Composer at
 * the bottom for sending threaded replies. Slides in from the right with
 * framer-motion animation. Escape key closes it.
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useThreadReplies } from '@/lib/hooks/useThreadReplies'
import { useRealtimeChannel, type BroadcastMessage } from '@/lib/hooks/useRealtimeChannel'
import { useAuth } from '@/lib/hooks/useAuth'
import type { MessageWithAuthor } from '@/lib/services/messageService'
import MessageBubble from './MessageBubble'
import Composer from './Composer'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreadPanelProps {
  channelId: string
  parentMessageId: string
  parentMessage: MessageWithAuthor
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastToMessage(msg: BroadcastMessage): MessageWithAuthor {
  return {
    id: msg.id,
    channelId: msg.channelId,
    authorId: msg.authorId,
    authorName: (msg.authorName as string) || 'Unknown',
    authorAvatar: (msg.authorAvatar as string) || null,
    content: msg.content,
    parentId: (msg.parentId as string) || null,
    replyCount: 0,
    editedAt: null,
    pinnedAt: null,
    createdAt: msg.createdAt,
    authorIsBot: false,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ThreadPanel({
  channelId,
  parentMessageId,
  parentMessage,
  onClose,
}: ThreadPanelProps) {
  const { user, orgId } = useAuth()
  const currentUserId = user.id

  // Fetch thread replies from API
  const { replies, isLoading } = useThreadReplies(channelId, parentMessageId)

  // Realtime: listen for new messages on this channel, filter to thread
  const { incomingMessage } = useRealtimeChannel({
    channelId,
    orgId: orgId || '',
    currentUserId: currentUserId || '',
    currentDisplayName: user.name || 'User',
  })

  // Track realtime thread replies
  const [realtimeReplies, setRealtimeReplies] = useState<MessageWithAuthor[]>([])

  useEffect(() => {
    if (!incomingMessage) return
    // Only append if it belongs to this thread
    const msgParentId = incomingMessage.parentId as string | undefined
    if (msgParentId !== parentMessageId) return

    setRealtimeReplies((prev) => {
      if (prev.some((m) => m.id === incomingMessage.id)) return prev
      return [...prev, broadcastToMessage(incomingMessage)]
    })
  }, [incomingMessage, parentMessageId])

  // Combine API replies with realtime replies
  const allReplies = useMemo(() => {
    const apiIds = new Set(replies.map((m) => m.id))
    const uniqueRealtime = realtimeReplies.filter((m) => !apiIds.has(m.id))
    return [...replies, ...uniqueRealtime]
  }, [replies, realtimeReplies])

  // Escape key closes panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // No-op typing handler for composer (thread typing not critical for MVP)
  const handleSendTyping = useCallback(() => {}, [])

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.2 }}
      className="w-[400px] max-w-full bg-white border-l border-slate-200 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">Thread</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
          aria-label="Close thread"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <MessageBubble
          message={parentMessage}
          isOwn={parentMessage.authorId === currentUserId}
          showAvatar
        />
      </div>

      {/* Thread replies */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="space-y-3 animate-pulse py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded bg-slate-200" />
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : allReplies.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-slate-400">
            No replies yet
          </div>
        ) : (
          allReplies.map((reply, i) => {
            const prevReply = i > 0 ? allReplies[i - 1] : undefined
            const isOwn = reply.authorId === currentUserId
            const showAvatar = !prevReply || prevReply.authorId !== reply.authorId

            return (
              <MessageBubble
                key={reply.id}
                message={reply}
                isOwn={isOwn}
                showAvatar={showAvatar}
              />
            )
          })
        )}
      </div>

      {/* Composer for thread replies */}
      <Composer
        channelId={channelId}
        onSendTyping={handleSendTyping}
        parentId={parentMessageId}
      />
    </motion.div>
  )
}
