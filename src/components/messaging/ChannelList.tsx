'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useChannels, type ShapedChannel } from '@/lib/hooks/useChannels'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSidebarTyping } from '@/lib/hooks/useSidebarTyping'
import ChannelListItem from './ChannelListItem'
import { Plus, Hash, Lock, X, Loader2, PenSquare, ChevronDown, ChevronRight, MessageCircle, Compass } from 'lucide-react'

interface ChannelListProps {
  activeChannelId: string | null
  onSelectChannel: (channelId: string) => void
  onCompose?: () => void
  onBrowseChannels?: () => void
}

function SkeletonItem() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 animate-pulse">
      <div className="w-4 h-4 rounded bg-slate-200 flex-shrink-0" />
      <div className="h-3 w-24 rounded bg-slate-200" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiCreateChannel(name: string, type: 'PUBLIC' | 'PRIVATE'): Promise<ShapedChannel> {
  const res = await fetch('/api/messaging/channels', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || 'Failed to create channel')
  return json.data
}

async function apiCreateDM(userIds: string[]): Promise<ShapedChannel> {
  const res = await fetch('/api/messaging/dms', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || 'Failed to start DM')
  return json.data
}

// ---------------------------------------------------------------------------
// Inline create forms
// ---------------------------------------------------------------------------

function InlineCreateChannel({
  onCreated,
  onCancel,
}: {
  onCreated: (ch: ShapedChannel) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => apiCreateChannel(name.trim(), isPrivate ? 'PRIVATE' : 'PUBLIC'),
    onSuccess: (ch) => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      onCreated(ch)
    },
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate() }}
      className="mx-2 mb-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200"
    >
      <div className="flex items-center gap-2">
        {isPrivate
          ? <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          : <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        }
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="channel-name"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={onCancel}
          className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => setIsPrivate(!isPrivate)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
        >
          {isPrivate ? <Lock className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
          {isPrivate ? 'Private' : 'Public'}
        </button>
        <button
          type="submit"
          disabled={!name.trim() || mutation.isPending}
          className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
        </button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-500 mt-1.5">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed'}
        </p>
      )}
    </form>
  )
}

interface InlineUserResult {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  lastActiveAt?: string | null
  jobTitle: string | null
  userRole?: { name: string; slug: string } | null
  teams?: { team: { name: string } }[]
  school?: { name: string } | null
}

function isUserOnline(lastActiveAt?: string | null): boolean {
  if (!lastActiveAt) return false
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000
}

function InlineNewDM({
  onCreated,
  onCancel,
}: {
  onCreated: (ch: ShapedChannel) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [results, setResults] = useState<InlineUserResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const membersRef = useRef(members)
  membersRef.current = members
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => apiCreateDM(members.map((m) => m.id)),
    onSuccess: (ch) => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      onCreated(ch)
    },
  })

  // Load users immediately on mount
  useEffect(() => {
    fetchUsers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchUsers(query: string) {
    setSearching(true)
    try {
      const url = query.length >= 2
        ? `/api/messaging/users?search=${encodeURIComponent(query)}&limit=20`
        : '/api/messaging/users?limit=20'
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      if (json.ok) {
        const selected = new Set(membersRef.current.map((m) => m.id))
        const users = json.data?.users ?? json.data ?? []
        setResults(users.filter((u: InlineUserResult) => !selected.has(u.id)))
      }
    } finally {
      setSearching(false)
    }
  }

  function handleSearch(query: string) {
    setSearch(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchUsers(query), 200)
  }

  function getUserName(u: InlineUserResult): string {
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email
  }

  function getUserMeta(u: InlineUserResult): string {
    const parts: string[] = []
    if (u.jobTitle) parts.push(u.jobTitle)
    if (u.userRole?.name) parts.push(u.userRole.name)
    if (u.teams?.length) parts.push(u.teams.map((t) => t.team.name).join(', '))
    if (u.school?.name) parts.push(u.school.name)
    return parts.join(' · ')
  }

  return (
    <div className="mx-2 mb-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">New message to:</span>
        <button
          type="button"
          onClick={onCancel}
          className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {members.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-50 text-primary-700 rounded-full"
            >
              {m.name}
              <button
                type="button"
                onClick={() => setMembers(members.filter((x) => x.id !== m.id))}
                className="hover:text-primary-900 cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        autoFocus
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search people..."
        className="w-full text-sm bg-transparent outline-none placeholder:text-slate-400"
      />

      {searching && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin mt-1.5" />}

      {results.length > 0 && (
        <div className="mt-1.5 max-h-52 overflow-y-auto space-y-0.5 border-t border-slate-100 pt-1.5">
          {results.map((u) => {
            const name = getUserName(u)
            const meta = getUserMeta(u)
            const initials = `${(u.firstName || '')[0] || ''}${(u.lastName || '')[0] || ''}`.toUpperCase() || '?'
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setMembers([...members, { id: u.id, name }])
                  setSearch('')
                  setResults([])
                }}
                className="w-full flex items-center gap-2.5 px-2 py-2 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors text-left"
              >
                <div className="relative w-8 h-8 flex-shrink-0">
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <span className="text-[11px] font-medium text-white">{initials}</span>
                    </div>
                  )}
                  {isUserOnline(u.lastActiveAt) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                  {meta && (
                    <div className="text-xs text-slate-400 truncate">{meta}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {members.length > 0 && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
          </button>
        </div>
      )}

      {mutation.isError && (
        <p className="text-xs text-red-500 mt-1.5">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsible section header (Slack-style)
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  collapsed,
  onToggle,
  onAdd,
  addTitle,
}: {
  label: string
  collapsed: boolean
  onToggle: () => void
  onAdd: () => void
  addTitle: string
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 group">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        }
        {label}
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="p-0.5 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 cursor-pointer rounded transition-all"
        title={addTitle}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChannelList({ activeChannelId, onSelectChannel, onCompose, onBrowseChannels }: ChannelListProps) {
  const { data: channels, isLoading } = useChannels()
  const { user, orgId } = useAuth()
  const typingMap = useSidebarTyping(orgId || '', user?.id || '')
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [channelsCollapsed, setChannelsCollapsed] = useState(false)
  const [dmsCollapsed, setDmsCollapsed] = useState(false)

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

  const queryClient = useQueryClient()

  function handleCreated(ch: ShapedChannel) {
    onSelectChannel(ch.id)
    setShowCreateChannel(false)
    setShowNewDM(false)
  }

  async function handleCloseDM(closedId: string) {
    // If we're viewing the closed chat, navigate to the next DM (or clear) immediately
    if (closedId === activeChannelId) {
      const remaining = grouped.dms.filter((ch) => ch.id !== closedId)
      const nextId = remaining[0]?.id ?? ''
      onSelectChannel(nextId)
      window.history.replaceState(null, '', nextId ? `/messaging?channel=${nextId}` : '/messaging')
    }
    // Refresh the channel list after navigation so the hidden DM disappears
    await queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
  }

  if (isLoading) {
    return (
      <div className="py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonItem key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with compose button */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800">Messaging</span>
        <button
          onClick={() => { onCompose ? onCompose() : setShowNewDM(true); setShowCreateChannel(false) }}
          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
          title="New message"
        >
          <PenSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Channels section */}
        <SectionHeader
          label="Channels"
          collapsed={channelsCollapsed}
          onToggle={() => setChannelsCollapsed(!channelsCollapsed)}
          onAdd={() => { setShowCreateChannel(true); setShowNewDM(false); setChannelsCollapsed(false) }}
          addTitle="Create channel"
        />

        {showCreateChannel && (
          <InlineCreateChannel
            onCreated={handleCreated}
            onCancel={() => setShowCreateChannel(false)}
          />
        )}

        {!channelsCollapsed && (
          grouped.channels.length > 0 ? (
            grouped.channels.map((ch) => (
              <ChannelListItem
                key={ch.id}
                channel={ch}
                isActive={ch.id === activeChannelId}
                onSelect={onSelectChannel}
                typingNames={typingMap.get(ch.id)}
              />
            ))
          ) : !showCreateChannel ? (
            <button
              onClick={() => setShowCreateChannel(true)}
              className="flex items-center gap-2.5 px-3 py-2 mx-2 text-[13px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors w-[calc(100%-1rem)]"
            >
              <Plus className="w-4 h-4" />
              Add a channel
            </button>
          ) : null
        )}

        {/* Browse channels */}
        {!channelsCollapsed && onBrowseChannels && (
          <button
            onClick={onBrowseChannels}
            className="flex items-center gap-2.5 px-3 py-2 mx-2 text-[13px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors w-[calc(100%-1rem)]"
          >
            <Compass className="w-4 h-4" />
            Browse channels
          </button>
        )}

        {/* Direct Messages section */}
        <div className="mt-2">
          <SectionHeader
            label="Direct messages"
            collapsed={dmsCollapsed}
            onToggle={() => setDmsCollapsed(!dmsCollapsed)}
            onAdd={() => { onCompose ? onCompose() : (setShowNewDM(true), setShowCreateChannel(false), setDmsCollapsed(false)) }}
            addTitle="New message"
          />

          {showNewDM && (
            <InlineNewDM
              onCreated={handleCreated}
              onCancel={() => setShowNewDM(false)}
            />
          )}

          {!dmsCollapsed && (
            grouped.dms.length > 0 ? (
              grouped.dms.map((ch) => (
                <ChannelListItem
                  key={ch.id}
                  channel={ch}
                  isActive={ch.id === activeChannelId}
                  onSelect={onSelectChannel}
                  onClose={handleCloseDM}
                  typingNames={typingMap.get(ch.id)}
                />
              ))
            ) : !showNewDM ? (
              <button
                onClick={() => onCompose ? onCompose() : setShowNewDM(true)}
                className="flex items-center gap-2.5 px-3 py-2 mx-2 text-[13px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors w-[calc(100%-1rem)]"
              >
                <Plus className="w-4 h-4" />
                Start a conversation
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}
