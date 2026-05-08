'use client'

import { useMemo } from 'react'
import { Hash, Lock, BellOff, X } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import type { ShapedChannel } from '@/lib/hooks/useChannels'

interface ChannelListItemProps {
  channel: ShapedChannel
  isActive: boolean
  onSelect: (channelId: string) => void
}

/**
 * Format a relative timestamp (e.g., "2m", "1h", "3d").
 */
function relativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

/**
 * Build display name for DMs — excludes the current user.
 * 1:1 DM: "Michael Lee" (full name)
 * Group DM: "anh, Caroline, chrissie, Eddie, ..."
 */
function getDMDisplayName(channel: ShapedChannel, currentUserId: string | null): string {
  if (!channel.members?.length) return channel.name

  // Filter out current user and members without user data
  const others = channel.members.filter((m) => m.user && m.userId !== currentUserId)

  if (!others.length) return channel.name

  // 1:1 DM — show full name
  if (others.length === 1) {
    const u = others[0].user
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown'
  }

  // Group DM — show first names, truncate after 4
  const names = others.map((m) => m.user.firstName || 'Unknown')
  if (names.length <= 4) return names.join(', ')
  return `${names.slice(0, 4).join(', ')}, ...`
}

export default function ChannelListItem({ channel, isActive, onSelect }: ChannelListItemProps) {
  const { userId } = useAuth()
  const isDM = channel.type === 'DM' || channel.type === 'GROUP_DM'
  const displayName = isDM ? getDMDisplayName(channel, userId) : channel.name

  // Check if channel is muted for current user
  const isMuted = useMemo(() => {
    if (!channel.members) return false
    return channel.members.some((m) => !!m.mutedAt)
  }, [channel.members])

  // Compute unread count from the current user's membership
  const unreadCount = useMemo(() => {
    if (!channel.members) return 0
    return channel.members.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0)
  }, [channel.members])

  const lastMessagePreview = channel.lastMessage?.content
    ? channel.lastMessage.content.length > 50
      ? channel.lastMessage.content.slice(0, 50) + '...'
      : channel.lastMessage.content
    : null

  const timestamp = channel.lastMessage?.createdAt
    ? relativeTime(channel.lastMessage.createdAt)
    : null

  // DM avatar: first letter of first member's name
  const dmAvatar = useMemo(() => {
    if (!isDM || !channel.members?.length) return null
    // Show the OTHER person's avatar, not the current user's
    const other = channel.members.find((m) => m.user && m.userId !== userId) ?? channel.members.find((m) => m.user)
    if (!other?.user) return null
    if (other.user.avatar) return other.user.avatar
    const initial = (other.user.firstName || 'U')[0].toUpperCase()
    return initial
  }, [isDM, channel.members, userId])

  return (
    <div className="group/item relative">
    <button
      onClick={() => onSelect(channel.id)}
      className={`w-full flex items-center gap-3 px-3 py-3 min-h-[56px] cursor-pointer transition-colors duration-200 ${
        isActive
          ? 'bg-primary-50 border-l-2 border-primary-500'
          : 'border-l-2 border-transparent hover:bg-white/50'
      } ${isMuted ? 'opacity-50' : ''}`}
    >
      {/* Icon / Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
        {isDM ? (
          typeof dmAvatar === 'string' && dmAvatar.length > 1 ? (
            <img
              src={dmAvatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-xs font-semibold text-primary-700">
              {dmAvatar || 'U'}
            </div>
          )
        ) : channel.type === 'PRIVATE' ? (
          <Lock className="w-4 h-4 text-slate-400" />
        ) : (
          <Hash className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm truncate ${
              unreadCount > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
            }`}
          >
            {displayName}
          </span>
          {timestamp && (
            <span className="text-xs text-slate-400 flex-shrink-0">{timestamp}</span>
          )}
        </div>
        {lastMessagePreview && (
          <p
            className={`text-xs truncate mt-0.5 ${
              unreadCount > 0 ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {lastMessagePreview}
          </p>
        )}
      </div>

      {/* Muted indicator */}
      {isMuted && (
        <BellOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      )}

      {/* Unread badge */}
      {unreadCount > 0 && !isMuted && (
        <span className="flex items-center justify-center bg-primary-500 text-white text-xs font-medium rounded-full min-w-[20px] h-5 px-1.5 flex-shrink-0">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>

    {/* Close/leave button on hover */}
    {isDM && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          // Hide immediately (optimistic)
          const el = e.currentTarget.closest('.group\\/item') as HTMLElement
          if (el) el.style.display = 'none'
          // Archive the DM channel so it disappears from the list
          fetch(`/api/messaging/channels/${channel.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: true }),
          })
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 opacity-0 group-hover/item:opacity-100 cursor-pointer transition-all z-10"
        title="Close conversation"
      >
        <X className="w-3 h-3" />
      </button>
    )}
    </div>
  )
}
