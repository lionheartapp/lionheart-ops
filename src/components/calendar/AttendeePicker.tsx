'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { usePeopleSearch, useAllPeople, type PeopleSearchResult } from '@/lib/hooks/useMeetWith'

export interface AttendeeSelection {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
}

interface AttendeePickerProps {
  value: AttendeeSelection[]
  onChange: (attendees: AttendeeSelection[]) => void
  compact?: boolean
  /**
   * 'search'   — type 2+ chars to search (default, for events)
   * 'dropdown' — shows all org members immediately, filterable by typing (for meetings)
   */
  variant?: 'search' | 'dropdown'
}

function Avatar({ person, size = 'sm' }: { person: { firstName?: string | null; email?: string; avatar?: string | null }; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
  const txt = size === 'sm' ? 'text-xs' : 'text-xs'
  return (
    <div className={`${dim} rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {person.avatar ? (
        <img src={person.avatar} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className={`${txt} font-medium text-slate-500`}>
          {(person.firstName?.[0] || person.email?.[0] || '?').toUpperCase()}
        </span>
      )}
    </div>
  )
}

/** Search variant — existing behaviour (type 2+ chars) */
function AttendeePickerSearch({ value, onChange, compact }: AttendeePickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [], isLoading } = usePeopleSearch(debouncedQuery)
  const filteredResults = results.filter((r) => !value.some((a) => a.id === r.id))

  useEffect(() => {
    if (!showResults) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showResults])

  const handleSelect = useCallback((result: PeopleSearchResult) => {
    onChange([...value, { id: result.id, firstName: result.firstName, lastName: result.lastName, email: result.email, avatar: result.avatar }])
    setQuery('')
    setDebouncedQuery('')
    setShowResults(false)
    inputRef.current?.focus()
  }, [value, onChange])

  const getFullName = (a: AttendeeSelection) => {
    if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`
    if (a.firstName) return a.firstName
    return a.email
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-slate-500 mb-1.5">Attendees</label>
      {value.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'mb-1.5' : 'mb-2'}`}>
          {value.map((attendee) => (
            <div key={attendee.id} className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-slate-100 text-xs">
              <Avatar person={attendee} size="sm" />
              <span className="text-slate-700 truncate max-w-[120px]">{attendee.firstName || attendee.email.split('@')[0]}</span>
              <button type="button" onClick={() => onChange(value.filter((a) => a.id !== attendee.id))} className="p-0.5 rounded-full hover:bg-slate-200 transition-colors" aria-label={`Remove ${getFullName(attendee)}`}>
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.length >= 2) setShowResults(true) }}
          onFocus={() => { if (query.length >= 2) setShowResults(true) }}
          placeholder="Add attendees..."
          className={`w-full pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 focus:border-slate-900 placeholder-slate-400 ${compact ? 'py-2' : 'py-3'}`}
          role="combobox" aria-expanded={showResults} aria-haspopup="listbox" aria-autocomplete="list"
        />
      </div>
      {showResults && debouncedQuery.length >= 2 && (
        <div role="listbox" className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1">
          {isLoading && <div className="px-3 py-2 text-xs text-slate-400">Searching...</div>}
          {!isLoading && filteredResults.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No results found</div>}
          {filteredResults.map((result) => (
            <button key={result.id} type="button" role="option" onClick={() => handleSelect(result)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors">
              <Avatar person={result} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-900 truncate">{result.firstName && result.lastName ? `${result.firstName} ${result.lastName}` : result.firstName || result.email}</div>
                {result.jobTitle && <div className="text-xs text-slate-400 truncate">{result.jobTitle}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Dropdown variant — loads all org members, filterable, add one at a time */
function AttendeePickerDropdown({ value, onChange, compact }: AttendeePickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: allPeople = [], isLoading } = useAllPeople()

  // Filter out already-selected, then apply text filter
  const filtered = allPeople.filter((p) => {
    if (value.some((a) => a.id === p.id)) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    const full = `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.email}`.toLowerCase()
    return full.includes(q)
  })

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback((person: PeopleSearchResult) => {
    onChange([...value, { id: person.id, firstName: person.firstName, lastName: person.lastName, email: person.email, avatar: person.avatar }])
    setQuery('')
    setOpen(false)
  }, [value, onChange])

  const getFullName = (a: AttendeeSelection) => {
    if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`
    if (a.firstName) return a.firstName
    return a.email
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-slate-500 mb-1.5">Attendees</label>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'mb-1.5' : 'mb-2'}`}>
          {value.map((attendee) => (
            <div key={attendee.id} className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-xs">
              <Avatar person={attendee} size="sm" />
              <span className="text-blue-800 truncate max-w-[120px] font-medium">{attendee.firstName || attendee.email.split('@')[0]}</span>
              <button type="button" onClick={() => onChange(value.filter((a) => a.id !== attendee.id))} className="p-0.5 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Remove ${getFullName(attendee)}`}>
                <X className="w-3 h-3 text-blue-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger button — opens the dropdown */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 50) }}
        className={`w-full flex items-center justify-between px-3 text-sm bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors ${compact ? 'py-2' : 'py-3'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-slate-400">
          {value.length === 0 ? 'Add attendees...' : `Add more attendees...`}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Search input inside dropdown */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 focus:border-slate-900 placeholder-slate-400"
              />
            </div>
          </div>

          {/* People list */}
          <div role="listbox" className="max-h-52 overflow-y-auto py-1">
            {isLoading && <div className="px-3 py-3 text-xs text-slate-400 text-center">Loading...</div>}
            {!isLoading && filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">
                {query ? 'No one found matching that name' : 'Everyone has been added'}
              </div>
            )}
            {filtered.map((person) => (
              <button
                key={person.id}
                type="button"
                role="option"
                onClick={() => handleSelect(person)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <Avatar person={person} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {person.firstName && person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName || person.email}
                  </div>
                  {person.jobTitle && <div className="text-xs text-slate-400 truncate">{person.jobTitle}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AttendeePicker({ variant = 'search', ...props }: AttendeePickerProps) {
  if (variant === 'dropdown') return <AttendeePickerDropdown {...props} />
  return <AttendeePickerSearch {...props} />
}
