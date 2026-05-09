'use client'

/**
 * ChannelHeader — displays channel name, description, member count,
 * pinned messages button, and mute toggle at the top of the message area.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Hash, Lock, Pin, BellOff, Bell, Users, Search, GraduationCap, UserPlus } from 'lucide-react'
import { usePinnedMessages } from '@/lib/hooks/usePinnedMessages'
import { useChannel } from '@/lib/hooks/useChannels'
import PersonSearchPanel from './PersonSearchPanel'

interface ChannelHeaderProps {
  channelId: string
  currentUserId: string | null
  onMuteToggle: () => void
  isMuted: boolean
  onSearchClick?: () => void
  onAddPerson?: (userId: string) => void
  onToggleMembers?: () => void
  showMembers?: boolean
  onTogglePinned?: () => void
  showPinnedPanel?: boolean
}

// ---------------------------------------------------------------------------
// Inline user search for add-person
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChannelHeader({
  channelId,
  currentUserId,
  onMuteToggle,
  isMuted,
  onSearchClick,
  onAddPerson,
  onToggleMembers,
  showMembers,
  onTogglePinned,
  showPinnedPanel,
}: ChannelHeaderProps) {
  const queryClient = useQueryClient()
  const [showAddPerson, setShowAddPerson] = useState(false)
  const { data: pinnedMessages } = usePinnedMessages(channelId)
  const { data: channel } = useChannel(channelId)

  const pinCount = pinnedMessages?.length ?? 0
  const isPrivate = channel?.type === 'PRIVATE'
  const isDM = channel?.type === 'DM' || channel?.type === 'GROUP_DM'

  const existingMemberIds = new Set(channel?.members?.map((m) => m.userId) ?? [])

  return (
    <div className="relative flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm">
        {/* Left: channel info */}
        <div className="relative flex items-center gap-2 min-w-0">
          {isDM && channel?.members ? (
            <>
              <span className="text-xs text-slate-400 flex-shrink-0 font-medium">To:</span>
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {channel.members
                  .filter((m) => m.userId !== currentUserId)
                  .map((m) => {
                    const name = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || 'User'
                    const initials = `${(m.user.firstName || '')[0] || ''}${(m.user.lastName || '')[0] || ''}`.toUpperCase() || '?'
                    return (
                      <span
                        key={m.userId}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-sm"
                      >
                        {m.user.avatar ? (
                          <img src={m.user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-medium text-white">
                            {initials}
                          </span>
                        )}
                        <span className="font-medium text-slate-700">{name}</span>
                      </span>
                    )
                  })}
              </div>
              {channel?.type === 'GROUP_DM' && (
                <button
                  type="button"
                  onClick={() => setShowAddPerson((prev) => !prev)}
                  className={`p-1 cursor-pointer rounded transition-colors ${
                    showAddPerson ? 'text-primary-600 bg-primary-50' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Add people"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {!isDM && (
                <span className="text-slate-400 flex-shrink-0">
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                </span>
              )}
              <h2 className="text-sm font-semibold text-slate-700 truncate">
                {channel?.name ?? 'Loading...'}
              </h2>
              {channel?.topic && (
                <span className="text-xs text-slate-400 truncate hidden sm:inline">
                  {channel.topic}
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Search */}
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
              title="Search messages (Cmd+K)"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Member count — toggles member panel */}
          {channel && (
            <button
              type="button"
              onClick={onToggleMembers}
              className={`flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg text-sm cursor-pointer transition-colors duration-200 ${
                showMembers
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="View members"
              aria-label={`View members (${channel.memberCount})`}
            >
              <Users className="w-[18px] h-[18px]" />
              {channel.memberCount}
            </button>
          )}

          {/* Add people (non-DM channels) */}
          {channel && !isDM && (
            <button
              type="button"
              onClick={() => setShowAddPerson((prev) => !prev)}
              className="flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
              title="Add people to channel"
            >
              <UserPlus className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Pinned messages */}
          <button
            type="button"
            onClick={onTogglePinned}
            className={`flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg text-sm cursor-pointer transition-colors duration-200 ${
              showPinnedPanel
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Pinned messages"
          >
            <Pin className="w-[18px] h-[18px]" />
            {pinCount > 0 && <span>{pinCount}</span>}
          </button>

          {/* Mute toggle */}
          <button
            type="button"
            onClick={onMuteToggle}
            className={`flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
              isMuted
                ? 'bg-amber-50 text-amber-600'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={isMuted ? 'Unmute channel' : 'Mute channel'}
          >
            {isMuted ? (
              <BellOff className="w-[18px] h-[18px]" />
            ) : (
              <Bell className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>
      </div>

      {/* Add person panel — full width below header */}
      {showAddPerson && onAddPerson && (
        <PersonSearchPanel
          excludeIds={existingMemberIds}
          onSelect={(user) => {
            if (!isDM) {
              // For channels: add member directly via API
              fetch(`/api/messaging/channels/${channelId}/members`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
              }).then((res) => {
                if (!res.ok) return
                queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
                queryClient.invalidateQueries({ queryKey: ['messaging', 'channels', channelId] })
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', channelId] })
                }, 1000)
              }).catch(() => {})
              setShowAddPerson(false)
            } else {
              onAddPerson(user.id)
              setShowAddPerson(false)
            }
          }}
          onClose={() => setShowAddPerson(false)}
        />
      )}

      {/* Source context banner for auto-channels */}
      {channel?.sourceType && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50/60 border-b border-indigo-100/60 text-xs text-indigo-600">
          {channel.sourceType === 'team' ? (
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <span className="font-medium">
            {channel.sourceType === 'team' ? 'Team' : 'School'}:
          </span>
          <a
            href={channel.sourceType === 'team'
              ? `/settings?tab=teams&id=${channel.sourceId}`
              : `/settings?tab=schools&id=${channel.sourceId}`}
            className="hover:underline font-medium text-indigo-700 cursor-pointer transition-colors duration-200"
          >
            {channel.sourceType === 'school' && channel.name.endsWith(' Staff')
              ? channel.name.slice(0, -6)
              : channel.name}
          </a>
          <span className="text-indigo-400">·</span>
          <span className="text-indigo-400">Auto-managed channel</span>
        </div>
      )}

    </div>
  )
}
