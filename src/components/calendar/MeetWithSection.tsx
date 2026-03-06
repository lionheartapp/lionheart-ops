'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Users } from 'lucide-react'
import { usePeopleSearch, MEET_WITH_COLORS, type MeetWithPerson, type PeopleSearchResult } from '@/lib/hooks/useMeetWith'

interface MeetWithSectionProps {
  people: MeetWithPerson[]
  onAdd: (person: MeetWithPerson) => void
  onRemove: (personId: string) => void
}

export default function MeetWithSection({ people, onAdd, onRemove }: MeetWithSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [], isLoading } = usePeopleSearch(debouncedQuery)

  // Filter out already-selected people
  const filteredResults = results.filter(
    (r) => !people.some((p) => p.id === r.id)
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
    if (people.length >= 5) return
    const colorIndex = people.length % MEET_WITH_COLORS.length
    const person: MeetWithPerson = {
      ...result,
      color: MEET_WITH_COLORS[colorIndex],
    }
    onAdd(person)
    setQuery('')
    setDebouncedQuery('')
    setShowResults(false)
    inputRef.current?.focus()
  }, [people, onAdd])

  const getDisplayName = (p: { firstName: string | null; lastName: string | null; email: string }) => {
    if (p.firstName) return p.firstName
    return p.email.split('@')[0]
  }

  const getFullName = (p: { firstName: string | null; lastName: string | null; email: string }) => {
    if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`
    if (p.firstName) return p.firstName
    return p.email
  }

  return (
    <div className="mb-1">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 py-2 text-xs font-semibold tracking-widest text-gray-400 uppercase hover:text-gray-600 transition-colors"
      >
        <Users className="w-3 h-3" />
        Meet with...
        {people.length > 0 && (
          <span className="ml-auto text-gray-300 normal-case tracking-normal font-normal text-xs">
            {people.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          {/* Search input */}
          <div ref={containerRef} className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
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
                placeholder="Search people..."
                disabled={people.length >= 5}
                className="w-full h-9 pl-8 pr-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-400 focus:border-primary-400 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Results dropdown */}
            {showResults && debouncedQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
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
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {result.avatar ? (
                        <img src={result.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-gray-500">
                          {(result.firstName?.[0] || result.email[0] || '?').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-900 truncate">{getFullName(result)}</div>
                      {result.jobTitle && (
                        <div className="text-xs text-gray-400 truncate">{result.jobTitle}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected people chips */}
          {people.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {people.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${person.color}15`,
                    color: person.color,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.avatar ? (
                      <img src={person.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (person.firstName?.[0] || person.email[0] || '?').toUpperCase()
                    )}
                  </div>
                  <span className="truncate max-w-[80px]">{getDisplayName(person)}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(person.id)}
                    className="p-0.5 rounded-full hover:bg-black/10 transition-colors"
                    aria-label={`Remove ${getFullName(person)}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
