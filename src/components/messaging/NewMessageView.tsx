'use client'

/**
 * NewMessageView — Slack-style "New message" compose screen.
 *
 * Shows a "To:" field with searchable dropdown of all org members and channels.
 * Selecting a person creates/finds a DM; selecting a channel navigates to it.
 * Rendered in the main message area when compose mode is active.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, Lock, X, Loader2 } from 'lucide-react'
import Composer from './Composer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserResult {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
  userRole?: { name: string } | null
  teams?: { team: { name: string } }[]
  school?: { name: string } | null
  status?: string
}

interface ChannelResult {
  id: string
  name: string
  type: string
  memberCount: number
}

interface Recipient {
  id: string
  name: string
  avatar: string | null
  type: 'user' | 'channel'
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function searchPeopleAndChannels(query: string): Promise<{
  users: UserResult[]
  channels: ChannelResult[]
}> {
  const [usersRes, channelsRes] = await Promise.all([
    fetch(`/api/settings/users?search=${encodeURIComponent(query)}&limit=10`, {
      credentials: 'include',
    }),
    fetch(`/api/messaging/channels?search=${encodeURIComponent(query)}`, {
      credentials: 'include',
    }).catch(() => null),
  ])

  const usersJson = await usersRes.json().catch(() => ({ ok: false }))
  const users: UserResult[] = usersJson.ok ? (usersJson.data?.users ?? usersJson.data ?? []) : []

  let channels: ChannelResult[] = []
  if (channelsRes?.ok) {
    const channelsJson = await channelsRes.json().catch(() => ({ ok: false }))
    channels = channelsJson.ok ? (channelsJson.data ?? []) : []
  }

  return { users, channels }
}

async function loadRecentPeople(): Promise<UserResult[]> {
  const res = await fetch('/api/settings/users?limit=15', { credentials: 'include' })
  const json = await res.json().catch(() => ({ ok: false }))
  return json.ok ? (json.data?.users ?? json.data ?? []) : []
}

async function createDM(userIds: string[]): Promise<{ id: string }> {
  const res = await fetch('/api/messaging/dms', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || 'Failed to create DM')
  return json.data
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserName(u: UserResult): string {
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email
}

function getUserMeta(u: UserResult): string {
  const parts: string[] = []
  if (u.jobTitle) parts.push(u.jobTitle)
  if (u.userRole?.name) parts.push(u.userRole.name)
  if (u.teams?.length) parts.push(u.teams.map((t) => t.team.name).join(', '))
  return parts.join(' · ')
}

function getInitials(u: UserResult): string {
  return `${(u.firstName || '')[0] || ''}${(u.lastName || '')[0] || ''}`.toUpperCase() || '?'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NewMessageViewProps {
  onChannelSelected: (channelId: string) => void
  onClose: () => void
}

export default function NewMessageView({ onChannelSelected, onClose }: NewMessageViewProps) {
  const [search, setSearch] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [results, setResults] = useState<{ users: UserResult[]; channels: ChannelResult[] }>({ users: [], channels: [] })
  const [recentPeople, setRecentPeople] = useState<UserResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [dmChannelId, setDmChannelId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Load recent people on mount
  useEffect(() => {
    loadRecentPeople().then(setRecentPeople)
  }, [])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Search with debounce
  useEffect(() => {
    if (search.length < 1) {
      setResults({ users: [], channels: [] })
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchPeopleAndChannels(search)
        // Filter out already-selected recipients
        const selectedIds = new Set(recipients.map((r) => r.id))
        data.users = data.users.filter((u) => !selectedIds.has(u.id))
        data.channels = data.channels.filter((c) => !selectedIds.has(c.id))
        setResults(data)
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [search, recipients])

  // Create DM mutation
  const dmMutation = useMutation({
    mutationFn: (userIds: string[]) => createDM(userIds),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      setDmChannelId(channel.id)
    },
  })

  // When user selects a person
  const handleSelectUser = useCallback((u: UserResult) => {
    const name = getUserName(u)
    setRecipients((prev) => [...prev, { id: u.id, name, avatar: u.avatar, type: 'user' }])
    setSearch('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }, [])

  // When user selects a channel
  const handleSelectChannel = useCallback((ch: ChannelResult) => {
    onChannelSelected(ch.id)
  }, [onChannelSelected])

  // Remove a recipient
  const handleRemoveRecipient = useCallback((id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id))
    setDmChannelId(null)
  }, [])

  // When recipients change, auto-create DM if we have user recipients
  useEffect(() => {
    const userRecipients = recipients.filter((r) => r.type === 'user')
    if (userRecipients.length > 0 && !dmChannelId) {
      dmMutation.mutate(userRecipients.map((r) => r.id))
    }
    if (userRecipients.length === 0) {
      setDmChannelId(null)
    }
  }, [recipients]) // eslint-disable-line react-hooks/exhaustive-deps

  // People to show in dropdown
  const displayUsers = search.length >= 1 ? results.users : recentPeople.filter((u) => !recipients.some((r) => r.id === u.id))
  const displayChannels = search.length >= 1 ? results.channels : []

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/60 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-800">New message</h2>
      </div>

      {/* To: field */}
      <div className="relative border-b border-slate-200/60 flex-shrink-0">
        <div className="flex items-center gap-2 px-5 py-2.5 min-h-[48px] flex-wrap">
          <span className="text-sm text-slate-400 font-medium flex-shrink-0">To:</span>

          {/* Selected recipients as chips */}
          {recipients.map((r) => {
            const initials = r.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
            return (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-primary-50 border border-primary-200 rounded-lg text-sm"
              >
                {r.avatar ? (
                  <img src={r.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-medium text-white">
                    {initials}
                  </span>
                )}
                <span className="font-medium text-primary-700">{r.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(r.id)}
                  className="ml-0.5 text-primary-400 hover:text-primary-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}

          {/* Search input */}
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            placeholder={recipients.length === 0 ? '#a-channel, @somebody, or somebody@example.com' : 'Add more...'}
            className="flex-1 min-w-[200px] text-sm bg-transparent outline-none placeholder:text-slate-400"
          />

          {searching && <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />}
        </div>

        {/* Dropdown */}
        {showDropdown && (displayUsers.length > 0 || displayChannels.length > 0) && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-50 mx-4 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-80 overflow-y-auto"
          >
            {/* Channels */}
            {displayChannels.length > 0 && (
              <div className="py-1">
                {displayChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChannel(ch)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <span className="text-slate-400 flex-shrink-0">
                      {ch.type === 'PRIVATE' ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{ch.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Divider if both */}
            {displayChannels.length > 0 && displayUsers.length > 0 && (
              <div className="border-t border-slate-100" />
            )}

            {/* People */}
            {displayUsers.length > 0 && (
              <div className="py-1">
                {displayUsers.map((u) => {
                  const name = getUserName(u)
                  const meta = getUserMeta(u)
                  const initials = getInitials(u)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-white">{initials}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{name}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Online" />
                          <span className="text-sm text-slate-500">{u.firstName} {u.lastName}</span>
                        </div>
                        {meta && (
                          <div className="text-xs text-slate-400 truncate">{meta}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message area — show composer once we have a DM channel */}
      <div className="flex-1 flex flex-col justify-end">
        {dmMutation.isError && (
          <div className="px-5 py-2 text-sm text-red-500">
            {dmMutation.error instanceof Error ? dmMutation.error.message : 'Failed to create conversation'}
          </div>
        )}
        {dmChannelId && (
          <div className="border-t border-slate-100">
            <Composer channelId={dmChannelId} />
          </div>
        )}
        {!dmChannelId && recipients.length === 0 && (
          <div className="px-5 pb-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-400">
              Select someone above to start a conversation
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
