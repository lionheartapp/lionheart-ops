'use client'

/**
 * MessageList -- virtual-scrolled message list using react-virtuoso.
 *
 * Renders messages newest-at-bottom with prepend-on-scroll-up for history loading.
 * Uses firstItemIndex pattern for stable scroll position during prepends.
 */

import { useCallback, useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { MessageWithAuthor } from '@/lib/services/messageService'
import type { ReactionGroup } from '@/lib/hooks/useReactions'
import MessageBubble from './MessageBubble'
import { MessageSquare } from 'lucide-react'

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
  channelName?: string
  channelType?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Large base index for prepend support -- Virtuoso needs this for stable prepend scrolling. */
const START_INDEX = 100_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if two messages are from the same author within 5 minutes. */
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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MessageSkeleton({ short }: { short?: boolean }) {
  return (
    <div className="flex gap-3 mt-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-12 bg-slate-100 rounded" />
        </div>
        <div
          className={`h-4 bg-slate-100 rounded ${short ? 'w-1/3' : 'w-2/3'}`}
        />
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

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

import { Hash, Lock, UserPlus } from 'lucide-react'

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
          <h3 className="text-lg font-bold text-slate-800">
            New conversation
          </h3>
          <p className="text-sm text-slate-500">
            This is the start of your direct message history.
          </p>
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
  channelName,
  channelType,
}: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const firstItemIndex = START_INDEX - messages.length

  const handleStartReached = useCallback(() => {
    if (hasMore && !isFetchingMore) {
      onLoadMore()
    }
  }, [hasMore, isFetchingMore, onLoadMore])

  // Initial loading state
  if (isLoading) {
    return <LoadingSkeletons />
  }

  // Empty state
  if (messages.length === 0) {
    return <EmptyState channelName={channelName} channelType={channelType} />
  }

  return (
    <div className="flex-1 relative">
      {/* Top loading spinner for history prepend */}
      {isFetchingMore && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-slate-200/60">
            <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">Loading older messages</span>
          </div>
        </div>
      )}

      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        startReached={handleStartReached}
        overscan={200}
        className="h-full"
        itemContent={(index, message) => {
          const dataIndex = index - firstItemIndex
          const prevMessage = dataIndex > 0 ? messages[dataIndex - 1] : undefined
          const isOwn = message.authorId === currentUserId
          const showAvatar = !shouldCollapse(message, prevMessage)

          const messageReactions = reactionsMap?.[message.id] ?? []

          return (
            <div className="px-4">
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
              />
            </div>
          )
        }}
      />
    </div>
  )
}
