'use client'

import { useMemo } from 'react'
import { useChannels, type ShapedChannel } from '@/lib/hooks/useChannels'
import ChannelListItem from './ChannelListItem'

interface ChannelListProps {
  activeChannelId: string | null
  onSelectChannel: (channelId: string) => void
}

function SkeletonItem() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 w-24 rounded bg-slate-200" />
        <div className="h-3 w-36 rounded bg-slate-100" />
      </div>
    </div>
  )
}

export default function ChannelList({ activeChannelId, onSelectChannel }: ChannelListProps) {
  const { data: channels, isLoading } = useChannels()

  const grouped = useMemo(() => {
    if (!channels?.length) return { channels: [], dms: [] }

    const channelGroup: ShapedChannel[] = []
    const dmGroup: ShapedChannel[] = []

    for (const ch of channels) {
      if (ch.type === 'DM' || ch.type === 'GROUP_DM') {
        dmGroup.push(ch)
      } else {
        channelGroup.push(ch)
      }
    }

    return { channels: channelGroup, dms: dmGroup }
  }, [channels])

  if (isLoading) {
    return (
      <div className="py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonItem key={i} />
        ))}
      </div>
    )
  }

  const hasChannels = grouped.channels.length > 0
  const hasDMs = grouped.dms.length > 0

  if (!hasChannels && !hasDMs) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-400">
        No channels yet
      </div>
    )
  }

  return (
    <div className="py-2">
      {hasChannels && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500 px-3 py-2 tracking-wide">
            Channels
          </h3>
          {grouped.channels.map((ch) => (
            <ChannelListItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              onSelect={onSelectChannel}
            />
          ))}
        </div>
      )}

      {hasDMs && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500 px-3 py-2 tracking-wide mt-2">
            Direct Messages
          </h3>
          {grouped.dms.map((ch) => (
            <ChannelListItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              onSelect={onSelectChannel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
