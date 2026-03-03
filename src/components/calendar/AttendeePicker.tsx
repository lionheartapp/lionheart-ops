'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { usePeopleSearch, type PeopleSearchResult } from '@/lib/hooks/useMeetWith'

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
}

export default function AttendeePicker({ value, onChange, compact = false }: AttendeePickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [], isLoading } = usePeopleSearch(debouncedQuery)

  const filteredResults = results.filter(
    (r) => !value.some((a) => a.id === r.id)
  )

  // Close dropdown on outside click
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
    const attendee: AttendeeSelection = {
      id: result.id,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      avatar: result.avatar,
    }
    onChange([...value, attendee])
    setQuery('')
    setDebouncedQuery('')
    setShowResults(false)
    inputRef.current?.focus()
  }, [value, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange(value.filter((a) => a.id !== id))
  }, [value, onChange])

  const getFullName = (a: AttendeeSelection) => {
    if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`
    if (a.firstName) return a.firstName
    return a.email
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1.5">Attendees</label>

      {/* Selected attendees */}
      {value.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'mb-1.5' : 'mb-2'}`}>
          {value.map((attendee) => (
            <div
              key={attendee.id}
              className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-gray-100 text-xs"
            >
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {attendee.avatar ? (
                  <img src={attendee.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-[10px] font-medium text-gray-500">
                    {(attendee.firstName?.[0] || attendee.email[0] || '?').toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-gray-700 truncate max-w-[120px]">
                {attendee.firstName || attendee.email.split('@')[0]}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(attendee.id)}
                className="p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                aria-label={`Remove ${getFullName(attendee)}`}
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.length >= 2) setShowResults(true)
          }}
          onFocus={() => {
            if (query.length >= 2) setShowResults(true)
          }}
          placeholder="Add attendees..."
          className={`w-full pl-9 pr-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/10 focus:border-gray-900 placeholder-gray-400 ${
            compact ? 'py-2' : 'py-3'
          }`}
          role="combobox"
          aria-expanded={showResults}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
      </div>

      {/* Results dropdown */}
      {showResults && debouncedQuery.length >= 2 && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1"
        >
          {isLoading && (
            <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
          )}
          {!isLoading && filteredResults.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No results found</div>
          )}
          {filteredResults.map((result) => (
            <button
              key={result.id}
              type="button"
              role="option"
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {result.avatar ? (
                  <img src={result.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-xs font-medium text-gray-500">
                    {(result.firstName?.[0] || result.email[0] || '?').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900 truncate">
                  {result.firstName && result.lastName
                    ? `${result.firstName} ${result.lastName}`
                    : result.firstName || result.email}
                </div>
                {result.jobTitle && (
                  <div className="text-xs text-gray-400 truncate">{result.jobTitle}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
