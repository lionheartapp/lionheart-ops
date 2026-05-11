'use client'

/**
 * PersonSearchPanel — reusable full-width panel that loads org members
 * immediately and lets you search/scroll to find someone.
 *
 * Used by:
 * - ChannelHeader (add person to DM)
 * - NewMessageView (pick who to message)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, X } from 'lucide-react'

interface UserResult {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  lastActiveAt?: string | null
}

function isOnline(lastActiveAt?: string | null): boolean {
  if (!lastActiveAt) return false
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000
}

export type { UserResult as PersonSearchUser }

interface PersonSearchPanelProps {
  /** IDs to exclude from results (e.g. existing members) */
  excludeIds?: Set<string>
  /** Called when a user is selected — passes full user data */
  onSelect: (user: UserResult) => void
  /** Called when the panel is closed */
  onClose: () => void
  /** Wrapper className override — defaults to overlay style for DM header */
  className?: string
  /** Whether selecting a person closes the panel (default: true) */
  closeOnSelect?: boolean
}

export default function PersonSearchPanel({
  excludeIds,
  onSelect,
  onClose,
  className,
  closeOnSelect = true,
}: PersonSearchPanelProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const excludeIdsRef = useRef(excludeIds)
  excludeIdsRef.current = excludeIds
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetchUsers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchUsers = useCallback(async (query: string) => {
    setSearching(true)
    try {
      const url = query
        ? `/api/messaging/users?search=${encodeURIComponent(query)}&limit=20`
        : '/api/messaging/users?limit=20'
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      if (json.ok) {
        const users: UserResult[] = Array.isArray(json.data) ? json.data : []
        const ids = excludeIdsRef.current
        setResults(ids ? users.filter((u) => !ids.has(u.id)) : users)
      }
    } catch {
      // Non-fatal
    } finally {
      setSearching(false)
    }
  }, [])

  function handleSearch(query: string) {
    setSearch(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchUsers(query), 200)
  }

  return (
    <div className={className ?? 'absolute top-full left-0 right-0 bg-white shadow-lg rounded-b-xl'} style={className ? undefined : { zIndex: 30 }}>
      {/* Search input row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search people..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
        />
        {searching && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />}
        <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg hover:bg-slate-200 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* User list — always visible, scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '384px' }}>
        {searching && results.length === 0 ? (
          <div className="px-4 py-4 text-xs text-slate-400 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : results.length > 0 ? (
          results.map((u) => {
            const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email
            const initials = `${(u.firstName || '')[0] || ''}${(u.lastName || '')[0] || ''}`.toUpperCase() || '?'
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => { onSelect(u); if (closeOnSelect) onClose() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-left"
              >
                <div className="relative w-8 h-8 flex-shrink-0">
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <span className="text-[11px] font-medium text-white">{initials}</span>
                    </div>
                  )}
                  {isOnline(u.lastActiveAt) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                  <div className="text-xs text-slate-400 truncate">{u.email}</div>
                </div>
              </button>
            )
          })
        ) : (
          <div className="px-4 py-4 text-xs text-slate-400 text-center">
            {search ? 'No matching people' : 'No people to add'}
          </div>
        )}
      </div>
    </div>
  )
}
