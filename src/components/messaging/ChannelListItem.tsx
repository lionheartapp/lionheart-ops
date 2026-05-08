'use client'

import { useMemo, useState } from 'react'
import { Hash, Lock, BellOff, X } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import type { ShapedChannel } from '@/lib/hooks/useChannels'

interface ChannelListItemProps {
  channel: ShapedChannel
  isActive: boolean
  onSelect: (channelId: string) => void
  onClose?: (channelId: string) => void
  typingNames?: string[]
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

export default function ChannelListItem({ channel, isActive, onSelect, onClose, typingNames }: ChannelListItemProps) {
  const { user } = useAuth()
  const [hidden, setHidden] = useState(false)
  const currentUserId = user?.id ?? null
  const isDM = channel.type === 'DM' || channel.type === 'GROUP_DM'
  const displayName = isDM ? getDMDisplayName(channel, currentUserId) : channel.name

  // Check if channel is muted for current user
  const isMuted = useMemo(() => {
    if (!channel.members) return false
    return channel.members.some((m) => !!m.mutedAt)
  }, [channel.members])

  // Compute unread count — suppress for the active channel
  const unreadCount = useMemo(() => {
    if (isActive || !channel.members || !currentUserId) return 0
    const self = channel.members.find((m) => m.userId === currentUserId)
    return self?.unreadCount ?? 0
  }, [isActive, channel.members, currentUserId])

  const timestamp = channel.lastMessage?.createdAt
    ? relativeTime(channel.lastMessage.createdAt)
    : null

  // DM avatar: first letter of first member's name
  const dmAvatar = useMemo(() => {
    if (!isDM || !channel.members?.length) return null
    // Show the OTHER person's avatar, not the current user's
    const other = channel.members.find((m) => m.user && m.userId !== currentUserId) ?? channel.members.find((m) => m.user)
    if (!other?.user) return null
    if (other.user.avatar) return other.user.avatar
    const initial = (other.user.firstName || 'U')[0].toUpperCase()
    return initial
  }, [isDM, channel.members, currentUserId])

  if (hidden) return null

  return (
    <div
      className={`group/item relative flex items-center gap-3 px-3 py-3 min-h-[56px] cursor-pointer transition-colors duration-200 ${
        isActive
          ? 'bg-primary-50 border-l-2 border-primary-500'
          : 'border-l-2 border-transparent hover:bg-white/50'
      } ${isMuted ? 'opacity-50' : ''}`}
      onClick={() => onSelect(channel.id)}
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      aria-label={displayName}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(channel.id) } }}
    >
      {/* Icon / Avatar */}
      <div className="relative w-8 h-8 flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center">
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
        {unreadCount > 0 && !isMuted && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary-500 border-2 border-white rounded-full" />
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
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Timestamp — hidden on hover when close button shows */}
            {timestamp && (
              <span className={`text-xs text-slate-400 ${isDM ? 'group-hover/item:hidden' : ''}`}>{timestamp}</span>
            )}
            {/* Close DM — replaces timestamp on hover */}
            {isDM && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setHidden(true)
                  fetch(`/api/messaging/channels/${channel.id}/hide`, {
                    method: 'POST',
                    credentials: 'include',
                  }).then((res) => {
                    if (!res.ok) setHidden(false) // rollback on failure
                  }).catch(() => setHidden(false))
                  onClose?.(channel.id)
                }}
                className="hidden group-hover/item:flex w-5 h-5 rounded-full items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer transition-all"
                title="Close conversation"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {/* Unread badge */}
            {unreadCount > 0 && !isMuted && (
              <span className="flex items-center justify-center bg-primary-500 text-white text-xs font-medium rounded-full min-w-[20px] h-5 px-1.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {/* Muted indicator */}
            {isMuted && (
              <BellOff className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>
        {typingNames && typingNames.length > 0 && (
          <p className="text-[11px] text-primary-500 italic truncate animate-pulse">
            {typingNames.length === 1
              ? `${typingNames[0]} is typing…`
              : `${typingNames[0]} and ${typingNames.length - 1} other${typingNames.length > 2 ? 's' : ''} typing…`}
          </p>
        )}
      </div>
    </div>
  )
}
