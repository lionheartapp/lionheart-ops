'use client'

/**
 * EventChatDrawer — right-side drawer for real-time event team chat.
 *
 * Slides in from the right like the ArchiveDrawer / ApprovalReviewDrawer.
 * Persists messages, auto-scrolls, and shows unread indicator when closed.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, MessageCircle } from 'lucide-react'
import { useEventChat, type ChatMessage } from '@/lib/hooks/useEventChat'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  HAIRLINE,
  CARD_SHADOW,
} from '@/lib/design/warm-tokens'

// ─── Message Bubble ──────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  showAuthor: boolean
}

function MessageBubble({ message, isOwn, showAuthor }: MessageBubbleProps) {
  const initials = message.userName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const timeAgo = (() => {
    try {
      return formatDistanceToNowStrict(new Date(message.createdAt), { addSuffix: false })
    } catch {
      return ''
    }
  })()

  return (
    <div className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar — only for other users when author header is shown */}
      {!isOwn && showAuthor ? (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: message.userAvatar
              ? undefined
              : 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
          }}
        >
          {message.userAvatar ? (
            <img
              src={message.userAvatar}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-white text-[9px] font-semibold">{initials}</span>
          )}
        </div>
      ) : !isOwn ? (
        <div className="w-7 flex-shrink-0" />
      ) : null}

      <div className={`max-w-[75%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showAuthor && !isOwn && (
          <span
            className="text-[10px] font-semibold mb-0.5 px-1"
            style={{ color: TEXT_SECONDARY }}
          >
            {message.userName}
          </span>
        )}
        <div
          className="px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed"
          style={{
            backgroundColor: isOwn ? TEXT_PRIMARY : WARM_CHIP,
            color: isOwn ? '#ffffff' : TEXT_PRIMARY,
            borderBottomRightRadius: isOwn ? 4 : undefined,
            borderBottomLeftRadius: !isOwn ? 4 : undefined,
          }}
        >
          {message.content}
        </div>
        {timeAgo && (
          <span
            className="text-[9px] mt-0.5 px-1"
            style={{ color: TEXT_MUTED }}
          >
            {timeAgo}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface EventChatDrawerProps {
  eventProjectId: string
  currentUserId: string | null | undefined
  currentUserName?: string
  isOpen: boolean
  onClose: () => void
  /** Called with new unread count when messages arrive while drawer is closed */
  onUnreadChange?: (count: number) => void
}

export function EventChatDrawer({
  eventProjectId,
  currentUserId,
  currentUserName,
  isOpen,
  onClose,
  onUnreadChange,
}: EventChatDrawerProps) {
  const { messages, sendMessage, isLoading } = useEventChat(
    eventProjectId,
    currentUserId,
    currentUserName,
  )
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track which messages the user has seen (for unread indicator)
  const lastSeenCountRef = useRef(0)

  // When drawer is open, mark all as seen
  useEffect(() => {
    if (isOpen) {
      lastSeenCountRef.current = messages.length
      onUnreadChange?.(0)
    }
  }, [isOpen, messages.length, onUnreadChange])

  // When drawer is closed and new messages from OTHER users arrive, bump unread
  useEffect(() => {
    if (!isOpen && messages.length > lastSeenCountRef.current) {
      const newMessages = messages.slice(lastSeenCountRef.current)
      const unread = newMessages.filter(m => m.userId !== currentUserId).length
      onUnreadChange?.(unread)
    }
  }, [isOpen, messages.length, onUnreadChange, currentUserId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }, [input, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group consecutive messages from same user
  const shouldShowAuthor = (msg: ChatMessage, i: number): boolean => {
    if (i === 0) return true
    return messages[i - 1].userId !== msg.userId
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(17, 15, 10, 0.3)' }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-md z-50 flex flex-col overflow-hidden sm:rounded-2xl"
            style={{
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              boxShadow: CARD_SHADOW,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  style={{ color: TEXT_SECONDARY }}
                />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
                >
                  Team Chat
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: TEXT_SECONDARY }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-3"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div
                    className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: WARM_CHIP,
                      borderTopColor: TEXT_MUTED,
                    }}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: WARM_CHIP }}
                  >
                    <MessageCircle
                      className="w-7 h-7"
                      strokeWidth={1.75}
                      style={{ color: TEXT_PRIMARY }}
                    />
                  </div>
                  <p
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
                  >
                    No messages yet
                  </p>
                  <p className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                    Start a conversation with your team about this event.
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.userId === currentUserId}
                    showAuthor={shouldShowAuthor(msg, i)}
                  />
                ))
              )}
            </div>

            {/* Input */}
            <div
              className="flex items-center gap-2 px-6 py-4 flex-shrink-0"
              style={{ borderTop: `1px solid ${HAIRLINE}` }}
            >
              {/* eslint-disable-next-line no-restricted-syntax -- chat-style composer (rounded-full pill, warm color theme); intentionally distinct from form Input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={2000}
                className="flex-1 text-[13px] px-4 py-2.5 rounded-full outline-none transition-colors"
                style={{
                  backgroundColor: WARM_CHIP,
                  color: TEXT_PRIMARY,
                  border: '1px solid transparent',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BORDER
                  e.currentTarget.style.backgroundColor = '#ffffff'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.backgroundColor = WARM_CHIP
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{
                  backgroundColor: input.trim() ? TEXT_PRIMARY : WARM_CHIP,
                  color: input.trim() ? '#ffffff' : TEXT_MUTED,
                }}
              >
                <Send className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
