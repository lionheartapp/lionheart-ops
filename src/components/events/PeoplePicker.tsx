'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, UserPlus, Info } from 'lucide-react'
import { queryOptions } from '@/lib/queries'
import { SearchInput } from '@/components/ui/SearchInput'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
  teams?: { team: { id: string; name: string } }[]
}

interface PeoplePickerProps {
  selectedUserIds: string[]
  onChange: (ids: string[]) => void
  /** Hide the title and info text (when wrapped in an external toggle card) */
  hideHeader?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayName(u: OrgUser) {
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return u.email
}

function initials(u: OrgUser) {
  if (u.firstName && u.lastName) return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase()
  if (u.firstName) return u.firstName[0].toUpperCase()
  return u.email[0].toUpperCase()
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PeoplePicker({ selectedUserIds, onChange, hideHeader = false }: PeoplePickerProps) {
  const { data: usersRaw } = useQuery(queryOptions.members())
  const users = (usersRaw ?? []) as OrgUser[]
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users.filter((u) => !selectedUserIds.includes(u.id))
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        !selectedUserIds.includes(u.id) &&
        (
          (u.firstName?.toLowerCase().includes(q)) ||
          (u.lastName?.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q) ||
          `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q)
        )
    )
  }, [users, search, selectedUserIds])

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedUserIds.includes(u.id)),
    [users, selectedUserIds]
  )

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <>
          <div className="flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Request Specific People</p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="w-3 h-3 flex-shrink-0" />
            <span>People will be notified after the event is fully approved.</span>
          </div>
        </>
      )}

      {/* Selected people chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-[13px] font-medium text-stone-800"
            >
              {u.avatar ? (
                <img src={u.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-stone-300 text-[9px] font-bold flex items-center justify-center text-stone-700 flex-shrink-0">
                  {initials(u)}
                </span>
              )}
              {displayName(u)}
              <button
                type="button"
                onClick={() => onChange(selectedUserIds.filter((id) => id !== u.id))}
                className="ml-0.5 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search by name or email..."
          onClear={search ? () => setSearch('') : undefined}
        />

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">
                {search ? 'No matching people found' : 'All members have been added'}
              </div>
            ) : (
              filteredUsers.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onChange([...selectedUserIds, u.id])
                    setSearch('')
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                >
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-[10px] font-bold flex items-center justify-center text-slate-600 flex-shrink-0">
                      {initials(u)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{displayName(u)}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {u.jobTitle || u.email}
                      {u.teams && u.teams.length > 0 && ` · ${u.teams.map(t => t.team.name).join(', ')}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
