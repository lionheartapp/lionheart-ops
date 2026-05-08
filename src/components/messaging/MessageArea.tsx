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
import Composer from './Composer'
import MembersPanel from './MembersPanel'
import PinnedMessagesPanel from './PinnedMessagesPanel'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageAreaProps {
  channelId: string
  onThreadClick: (messageId: string, message?: MessageWithAuthor) => void
  onSearchClick?: () => void
  onAddPerson?: (userId: string) => void
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
    authorIsBot: (msg as Record<string, unknown>).authorIsBot === true,
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

export default function MessageArea({ channelId, onThreadClick, onSearchClick, onAddPerson }: MessageAreaProps) {
  const { user, orgId } = useAuth()
  const queryClient = useQueryClient()
  const [showMembers, setShowMembers] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
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

  // Re-mark as read when tab regains focus (handles tab-switching scenarios)
  useEffect(() => {
    if (!channelId) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markRead.mutate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
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

  // Edit message — sets editingId, the MessageBubble renders inline editor
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleEdit = useCallback((messageId: string) => {
    setEditingId(messageId)
  }, [])

  const handleEditSave = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        await fetch(`/api/messaging/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: newContent }),
        })
        queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', channelId] })
      } catch { /* silent */ }
      setEditingId(null)
    },
    [channelId, queryClient],
  )

  const handleEditCancel = useCallback(() => {
    setEditingId(null)
  }, [])

  // Delete message
  const handleDelete = useCallback(
    async (messageId: string) => {
      // Confirmation is handled in the MessageBubble dropdown
      try {
        await fetch(`/api/messaging/messages/${messageId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', channelId] })
      } catch { /* silent */ }
    },
    [channelId, queryClient],
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
    <div className="flex-1 flex min-h-0 h-full relative">
      {/* Main message column */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <ChannelHeader
          channelId={channelId}
          currentUserId={currentUserId}
          onMuteToggle={handleMuteToggle}
          isMuted={isMuted}
          onSearchClick={onSearchClick}
          onAddPerson={onAddPerson}
          onToggleMembers={() => setShowMembers((prev) => !prev)}
          showMembers={showMembers}
          onTogglePinned={() => setShowPinned((prev) => !prev)}
          showPinnedPanel={showPinned}
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
          onEdit={handleEdit}
          onEditSave={handleEditSave}
          onEditCancel={handleEditCancel}
          editingId={editingId}
          onDelete={handleDelete}
          channelName={channel?.name}
          channelType={channel?.type}
        />
        <TypingIndicator names={typingNames} />
        <Composer channelId={channelId} />
      </div>

      {/* Side panels — only one at a time */}
      {showMembers && (
        <MembersPanel
          channelId={channelId}
          onClose={() => setShowMembers(false)}
          onLeave={() => {
            queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
          }}
        />
      )}
      {showPinned && !showMembers && (
        <PinnedMessagesPanel
          channelId={channelId}
          onClose={() => setShowPinned(false)}
        />
      )}
    </div>
  )
}
