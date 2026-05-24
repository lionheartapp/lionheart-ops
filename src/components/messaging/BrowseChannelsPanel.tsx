'use client'

/**
 * BrowseChannelsPanel — discover and join public/private channels.
 * Public channels show "Join" (instant). Private channels show "Ask to Join"
 * (sends a request to existing members) or "Pending" if already requested.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Hash, Lock, Users, Loader2, X, Clock } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface BrowsableChannel {
  id: string
  name: string
  type: 'PUBLIC' | 'PRIVATE'
  description: string | null
  memberCount: number
  joined?: boolean
  pendingRequest?: boolean
}

interface BrowseChannelsPanelProps {
  onJoined: (channelId: string) => void
  onClose: () => void
}

export default function BrowseChannelsPanel({ onJoined, onClose }: BrowseChannelsPanelProps) {
  const [search, setSearch] = useState('')
  const [channels, setChannels] = useState<BrowsableChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    inputRef.current?.focus()
    fetchChannels('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchChannels = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const url = query
        ? `/api/messaging/channels/browse?search=${encodeURIComponent(query)}`
        : '/api/messaging/channels/browse'
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      if (json.ok) {
        const data: BrowsableChannel[] = Array.isArray(json.data) ? json.data : []
        setChannels(data)
        // Initialize pending state from server data
        setPendingIds(new Set(data.filter((ch) => ch.pendingRequest).map((ch) => ch.id)))
      }
    } catch (_err) {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSearch(query: string) {
    setSearch(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchChannels(query), 200)
  }

  async function handleJoin(channelId: string) {
    setJoiningId(channelId)
    try {
      const res = await fetch(`/api/messaging/channels/${channelId}/join`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await queryClient.refetchQueries({ queryKey: ['messaging', 'channels'] })
        onJoined(channelId)
      }
    } finally {
      setJoiningId(null)
    }
  }

  async function handleRequestJoin(channelId: string) {
    setJoiningId(channelId)
    try {
      const res = await fetch(`/api/messaging/channels/${channelId}/join-request`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setPendingIds((prev) => new Set([...prev, channelId]))
      }
    } finally {
      setJoiningId(null)
    }
  }

  async function handleLeave(channelId: string) {
    setJoiningId(channelId)
    try {
      const res = await fetch(`/api/messaging/channels/${channelId}/leave`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        // Update local state so button switches to Join / Ask to Join
        setChannels((prev) => prev.map((ch) =>
          ch.id === channelId ? { ...ch, joined: false } : ch
        ))
        await queryClient.refetchQueries({ queryKey: ['messaging', 'channels'] })
      }
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-800">Browse channels</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search channels..."
          size="sm"
          className="h-auto min-h-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-slate-400 focus:ring-0"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {loading && channels.length === 0 ? (
          <div className="px-4 py-8 text-xs text-slate-400 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : channels.length > 0 ? (
          channels.map((ch) => {
            const isPrivate = ch.type === 'PRIVATE'
            const isJoined = ch.joined
            const isPending = pendingIds.has(ch.id)
            const isActing = joiningId === ch.id

            return (
              <div
                key={ch.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {isPrivate ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Hash className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{ch.name}</span>
                    {isJoined && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Joined</span>
                    )}
                  </div>
                  {ch.description && (
                    <div className="text-xs text-slate-400 truncate">{ch.description}</div>
                  )}
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                    <Users className="w-3 h-3" />
                    {ch.memberCount} member{ch.memberCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {isJoined ? (
                  <button
                    type="button"
                    onClick={() => handleLeave(ch.id)}
                    disabled={isActing}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-full cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Leave'}
                  </button>
                ) : isPending ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-full">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                ) : isPrivate ? (
                  <button
                    type="button"
                    onClick={() => handleRequestJoin(ch.id)}
                    disabled={isActing}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-full cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ask to Join'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleJoin(ch.id)}
                    disabled={isActing}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-full cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Join'}
                  </button>
                )}
              </div>
            )
          })
        ) : (
          <div className="px-4 py-8 text-center">
            <Hash className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {search ? 'No matching channels' : 'No channels to join'}
            </p>
            <p className="text-xs text-slate-300 mt-1">
              You&apos;re already in all available channels
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
