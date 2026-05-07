'use client'

/**
 * ChannelHeader — displays channel name, description, member count,
 * pinned messages button, and mute toggle at the top of the message area.
 */

import { useState } from 'react'
import { Hash, Lock, Pin, BellOff, Bell, Users, Search, GraduationCap } from 'lucide-react'
import { usePinnedMessages } from '@/lib/hooks/usePinnedMessages'
import { useChannel } from '@/lib/hooks/useChannels'
import PinnedMessagesPanel from './PinnedMessagesPanel'

interface ChannelHeaderProps {
  channelId: string
  currentUserId: string | null
  onMuteToggle: () => void
  isMuted: boolean
  onSearchClick?: () => void
}

export default function ChannelHeader({
  channelId,
  currentUserId,
  onMuteToggle,
  isMuted,
  onSearchClick,
}: ChannelHeaderProps) {
  const [showPinned, setShowPinned] = useState(false)
  const { data: pinnedMessages } = usePinnedMessages(channelId)
  const { data: channel } = useChannel(channelId)

  const pinCount = pinnedMessages?.length ?? 0
  const isPrivate = channel?.type === 'PRIVATE'
  const isDM = channel?.type === 'DM' || channel?.type === 'GROUP_DM'

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 flex-shrink-0 bg-white/50 backdrop-blur-sm">
        {/* Left: channel info */}
        <div className="flex items-center gap-2 min-w-0">
          {!isDM && (
            <span className="text-slate-400 flex-shrink-0">
              {isPrivate ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
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
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Search */}
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
              title="Search messages (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Member count */}
          {channel && (
            <span className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5" />
              {channel.memberCount}
            </span>
          )}

          {/* Pinned messages */}
          <button
            type="button"
            onClick={() => setShowPinned((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors duration-200 ${
              showPinned
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Pinned messages"
          >
            <Pin className="w-3.5 h-3.5" />
            {pinCount > 0 && <span>{pinCount}</span>}
          </button>

          {/* Mute toggle */}
          <button
            type="button"
            onClick={onMuteToggle}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors duration-200 ${
              isMuted
                ? 'bg-amber-50 text-amber-600'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={isMuted ? 'Unmute channel' : 'Mute channel'}
          >
            {isMuted ? (
              <BellOff className="w-3.5 h-3.5" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

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

      {/* Pinned messages panel overlay */}
      {showPinned && (
        <div className="absolute right-0 top-0 bottom-0 z-30">
          <PinnedMessagesPanel
            channelId={channelId}
            onClose={() => setShowPinned(false)}
          />
        </div>
      )}
    </>
  )
}
