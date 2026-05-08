'use client'

import { useMemo } from 'react'
import { Hash, Lock, BellOff } from 'lucide-react'
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
 * Build display name for DMs. For DMs, show the other user's name.
 * For group DMs, comma-separate first names.
 */
function getDMDisplayName(channel: ShapedChannel): string {
  if (!channel.members?.length) return channel.name

  const names = channel.members
    .filter((m) => m.user)
    .map((m) => m.user.firstName || 'Unknown')
    .slice(0, 4)

  if (!names.length) return channel.name
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${channel.members.length - 3}`
}

export default function ChannelListItem({ channel, isActive, onSelect }: ChannelListItemProps) {
  const isDM = channel.type === 'DM' || channel.type === 'GROUP_DM'
  const displayName = isDM ? getDMDisplayName(channel) : channel.name

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
    const member = channel.members[0]
    if (!member?.user) return null
    if (member.user.avatar) return member.user.avatar
    const initial = (member.user.firstName || 'U')[0].toUpperCase()
    return initial
  }, [isDM, channel.members])

  return (
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
  )
}
