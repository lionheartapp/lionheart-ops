'use client'

/**
 * MessageList — scrollable message list with load-more-on-scroll-up.
 *
 * Uses a plain div with overflow-y-auto and a sentinel element at the top
 * for infinite scroll (loading older messages). Newest messages at bottom.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { MessageWithAuthor } from '@/lib/services/messageService'
import type { ReactionGroup } from '@/lib/hooks/useReactions'
import MessageBubble from './MessageBubble'
import { Hash, Lock, MessageSquare } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageListProps {
  messages: MessageWithAuthor[]
  isLoading: boolean
  hasMore: boolean
  isFetchingMore: boolean
  onLoadMore: () => void
  onThreadClick: (messageId: string, message?: MessageWithAuthor) => void
  currentUserId: string | null
  reactionsMap?: Record<string, ReactionGroup[]>
  onReactionToggle?: (messageId: string, emoji: string) => void
  onPin?: (messageId: string) => void
  onEdit?: (messageId: string) => void
  onEditSave?: (messageId: string, content: string) => void
  onEditCancel?: () => void
  editingId?: string | null
  onDelete?: (messageId: string) => void
  channelName?: string
  channelType?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldCollapse(
  current: MessageWithAuthor,
  previous: MessageWithAuthor | undefined,
): boolean {
  if (!previous) return false
  if (current.authorId !== previous.authorId) return false
  const diffMs =
    new Date(current.createdAt).getTime() -
    new Date(previous.createdAt).getTime()
  return Math.abs(diffMs) < 5 * 60 * 1000
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

function MessageSkeleton({ short }: { short?: boolean }) {
  return (
    <div className="flex gap-3 mt-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-12 bg-slate-100 rounded" />
        </div>
        <div className={`h-4 bg-slate-100 rounded ${short ? 'w-1/3' : 'w-2/3'}`} />
      </div>
    </div>
  )
}

function LoadingSkeletons() {
  return (
    <div className="p-4 space-y-1">
      <MessageSkeleton />
      <MessageSkeleton short />
      <MessageSkeleton />
      <MessageSkeleton short />
      <MessageSkeleton />
      <MessageSkeleton short />
    </div>
  )
}

function EmptyState({ channelName, channelType }: { channelName?: string; channelType?: string }) {
  const isDM = channelType === 'DM' || channelType === 'GROUP_DM'
  const isPrivate = channelType === 'PRIVATE'

  return (
    <div className="flex-1 flex flex-col items-start justify-end gap-2 px-6 pb-6">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center mb-1">
        {isDM ? (
          <MessageSquare className="w-6 h-6 text-primary-500" />
        ) : isPrivate ? (
          <Lock className="w-6 h-6 text-primary-500" />
        ) : (
          <Hash className="w-6 h-6 text-primary-500" />
        )}
      </div>
      {channelName && !isDM ? (
        <>
          <h3 className="text-lg font-bold text-slate-800">
            Welcome to #{channelName}
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            This is the very beginning of the <span className="font-semibold">#{channelName}</span> channel.
            Invite others to start collaborating.
          </p>
        </>
      ) : isDM ? (
        <>
          <h3 className="text-lg font-bold text-slate-800">New conversation</h3>
          <p className="text-sm text-slate-500">This is the start of your direct message history.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-500">No messages yet</p>
          <p className="text-xs text-slate-400">Start the conversation!</p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessageList({
  messages,
  isLoading,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onThreadClick,
  currentUserId,
  reactionsMap,
  onReactionToggle,
  onPin,
  onEdit,
  onEditSave,
  onEditCancel,
  editingId,
  onDelete,
  channelName,
  channelType,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | undefined>(undefined)
  const prevMessageCountRef = useRef(0)

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [])

  // On initial load, scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && prevMessageCountRef.current === 0) {
      // First batch of messages loaded — jump to bottom.
      // Double-rAF ensures the container has its final dimensions after layout.
      requestAnimationFrame(() => requestAnimationFrame(scrollToBottom))
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, scrollToBottom])

  // When a new message is appended at the bottom, scroll down
  useEffect(() => {
    const newestId = messages[messages.length - 1]?.id
    if (!newestId) return
    if (lastMessageIdRef.current === undefined) {
      lastMessageIdRef.current = newestId
      return
    }
    if (newestId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = newestId
      requestAnimationFrame(scrollToBottom)
    }
  }, [messages, scrollToBottom])

  // IntersectionObserver to load older messages when scrolling to top
  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isFetchingMore) {
          // Save scroll height before prepend so we can restore position
          const prevHeight = container.scrollHeight
          const prevTop = container.scrollTop

          onLoadMore()

          // After older messages prepend, restore scroll position
          requestAnimationFrame(() => {
            const newHeight = container.scrollHeight
            container.scrollTop = prevTop + (newHeight - prevHeight)
          })
        }
      },
      { root: container, threshold: 0, rootMargin: '100px 0px 0px 0px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isFetchingMore, onLoadMore])

  if (isLoading) {
    return <div className="flex-1 min-h-0"><LoadingSkeletons /></div>
  }

  if (messages.length === 0) {
    return <div className="flex-1 min-h-0"><EmptyState channelName={channelName} channelType={channelType} /></div>
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto relative">
      {/* Top sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading spinner for older messages */}
      {isFetchingMore && (
        <div className="flex justify-center py-3">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-slate-200/60">
            <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">Loading older messages</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="px-4">
        {messages.map((message, i) => {
          const prevMessage = i > 0 ? messages[i - 1] : undefined
          const isOwn = message.authorId === currentUserId
          const showAvatar = !shouldCollapse(message, prevMessage)
          const messageReactions = reactionsMap?.[message.id] ?? []
          const showDateSep = !prevMessage || !isSameDay(message.createdAt, prevMessage.createdAt)

          return (
            <div key={message.id}>
              {showDateSep && <DateSeparator label={getDateLabel(message.createdAt)} />}
              <MessageBubble
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                onThreadClick={onThreadClick}
                reactions={messageReactions}
                onReactionToggle={
                  onReactionToggle
                    ? (emoji: string) => onReactionToggle(message.id, emoji)
                    : undefined
                }
                onPin={onPin}
                isPinned={!!message.pinnedAt}
                onEdit={onEdit}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
                isEditing={editingId === message.id}
                onDelete={onDelete}
              />
            </div>
          )
        })}
      </div>

      {/* Bottom anchor */}
      <div ref={bottomRef} className="h-8" />
    </div>
  )
}
