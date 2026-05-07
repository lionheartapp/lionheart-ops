'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useChannels, type ShapedChannel } from '@/lib/hooks/useChannels'
import ChannelListItem from './ChannelListItem'
import { Plus, Hash, X, Loader2 } from 'lucide-react'

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

async function createChannel(name: string): Promise<ShapedChannel> {
  const res = await fetch('/api/messaging/channels', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type: 'PUBLIC' }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || 'Failed to create channel')
  return json.data
}

export default function ChannelList({ activeChannelId, onSelectChannel }: ChannelListProps) {
  const { data: channels, isLoading } = useChannels()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (name: string) => createChannel(name),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      onSelectChannel(channel.id)
      setShowCreate(false)
      setNewName('')
    },
  })

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

  const createForm = showCreate ? (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (newName.trim()) createMutation.mutate(newName.trim())
      }}
      className="px-3 py-2 border-b border-slate-100"
    >
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="channel-name"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-300"
        />
        <button
          type="button"
          onClick={() => { setShowCreate(false); setNewName('') }}
          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {createMutation.isError && (
        <p className="text-xs text-red-500 mt-1 px-6">
          {createMutation.error instanceof Error ? createMutation.error.message : 'Failed'}
        </p>
      )}
      <div className="flex justify-end mt-2">
        <button
          type="submit"
          disabled={!newName.trim() || createMutation.isPending}
          className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
        </button>
      </div>
    </form>
  ) : null

  if (!hasChannels && !hasDMs) {
    return (
      <div className="py-2">
        {createForm}
        <div className="flex flex-col items-center justify-center h-32 gap-3">
          <p className="text-sm text-slate-400">No channels yet</p>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create channel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="py-2">
      {createForm}
      {hasChannels && (
        <div>
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-xs font-semibold uppercase text-slate-500 tracking-wide">
              Channels
            </h3>
            <button
              onClick={() => setShowCreate(true)}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded transition-colors"
              title="Create channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
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
