'use client'

/**
 * MessageArea -- orchestrates message display, realtime delivery, typing indicators,
 * reactions, pin/unpin, and channel header with mute toggle.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMessages, useMarkChannelRead } from '@/lib/hooks/useMessages'
import { useRealtimeChannel, type BroadcastMessage } from '@/lib/hooks/useRealtimeChannel'
import { useReactions, useToggleReaction } from '@/lib/hooks/useReactions'
import { useChannel } from '@/lib/hooks/useChannels'
import { useAuth } from '@/lib/hooks/useAuth'
import type { MessageWithAuthor } from '@/lib/services/messageService'
import MessageList from './MessageList'
import ChannelHeader from './ChannelHeader'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageAreaProps {
  channelId: string
  onThreadClick: (messageId: string, message?: MessageWithAuthor) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a BroadcastMessage to MessageWithAuthor shape for display. */
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
  }
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null

  const text =
    names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing...`
        : `${names[0]} and ${names.length - 1} others are typing...`

  return (
    <div className="px-4 py-1.5">
      <p className="text-xs text-slate-500 italic animate-pulse">{text}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessageArea({ channelId, onThreadClick }: MessageAreaProps) {
  const { user, orgId } = useAuth()
  const queryClient = useQueryClient()
  const currentUserId = user.id
  const currentDisplayName = user.name

  // Paginated messages from API
  const {
    messages: apiMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMessages(channelId)

  // Realtime messages
  const {
    incomingMessage,
    typingUsers,
  } = useRealtimeChannel({
    channelId,
    orgId: orgId || '',
    currentUserId: currentUserId || '',
    currentDisplayName: currentDisplayName || 'User',
  })

  // Local realtime messages that haven't been fetched from the API yet
  const [realtimeMessages, setRealtimeMessages] = useState<MessageWithAuthor[]>([])
  const prevChannelRef = useRef(channelId)

  // Mark channel as read on open / channel change
  const markRead = useMarkChannelRead(channelId)
  useEffect(() => {
    if (channelId) {
      markRead.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  // Clear realtime messages when channel changes
  useEffect(() => {
    if (prevChannelRef.current !== channelId) {
      setRealtimeMessages([])
      prevChannelRef.current = channelId
    }
  }, [channelId])

  // Append incoming realtime messages
  useEffect(() => {
    if (!incomingMessage) return

    setRealtimeMessages((prev) => {
      // Skip if already present
      if (prev.some((m) => m.id === incomingMessage.id)) return prev
      return [...prev, broadcastToMessage(incomingMessage)]
    })
  }, [incomingMessage])

  // Combined + deduplicated messages (API messages take priority for data completeness)
  const combinedMessages = useMemo(() => {
    const apiIds = new Set(apiMessages.map((m) => m.id))
    const uniqueRealtime = realtimeMessages.filter((m) => !apiIds.has(m.id))
    return [...apiMessages, ...uniqueRealtime]
  }, [apiMessages, realtimeMessages])

  // Reactions for visible messages
  const messageIds = useMemo(
    () => combinedMessages.map((m) => m.id),
    [combinedMessages],
  )
  const { data: reactionsMap } = useReactions(channelId, messageIds, currentUserId)
  const toggleReaction = useToggleReaction(channelId)

  const handleReactionToggle = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction.mutate({ messageId, emoji })
    },
    [toggleReaction],
  )

  // Pin/unpin handler
  const handlePin = useCallback(
    async (messageId: string) => {
      const message = combinedMessages.find((m) => m.id === messageId)
      const isPinned = !!message?.pinnedAt
      try {
        await fetch(`/api/messaging/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pinnedAt: isPinned ? null : 'now' }),
        })
        // Invalidate messages and pinned messages queries
        queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', channelId] })
        queryClient.invalidateQueries({ queryKey: ['messaging', 'pinned-messages', channelId] })
      } catch {
        // Silently fail -- could add toast notification here
      }
    },
    [combinedMessages, channelId, queryClient],
  )

  // Mute toggle
  const { data: channel } = useChannel(channelId)
  const isMuted = useMemo(() => {
    if (!channel?.members || !currentUserId) return false
    return channel.members.some(
      (m) => m.userId === currentUserId && !!m.mutedAt,
    )
  }, [channel, currentUserId])

  const handleMuteToggle = useCallback(async () => {
    try {
      await fetch(`/api/messaging/channels/${channelId}/mute`, {
        method: 'POST',
        credentials: 'include',
      })
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels', channelId] })
    } catch {
      // Silently fail
    }
  }, [channelId, queryClient])

  // Typing user display names
  const typingNames = useMemo(
    () => typingUsers.map((u) => u.displayName),
    [typingUsers],
  )

  const handleLoadMore = useCallback(() => {
    fetchNextPage()
  }, [fetchNextPage])

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <ChannelHeader
        channelId={channelId}
        currentUserId={currentUserId}
        onMuteToggle={handleMuteToggle}
        isMuted={isMuted}
      />
      <MessageList
        messages={combinedMessages}
        isLoading={isLoading}
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
        onLoadMore={handleLoadMore}
        onThreadClick={onThreadClick}
        currentUserId={currentUserId}
        reactionsMap={reactionsMap}
        onReactionToggle={handleReactionToggle}
        onPin={handlePin}
      />
      <TypingIndicator names={typingNames} />
    </div>
  )
}
