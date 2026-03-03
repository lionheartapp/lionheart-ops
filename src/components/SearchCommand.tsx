'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, User, Calendar, Ticket, MapPin, X } from 'lucide-react'
import { useGlobalSearch, type SearchResults } from '@/lib/hooks/useGlobalSearch'

interface SearchCommandProps {
  isOpen: boolean
  onClose: () => void
}

type ResultItem = {
  type: 'user' | 'event' | 'ticket' | 'location'
  id: string
  label: string
  sublabel?: string
  href: string
}

function flattenResults(data: SearchResults | undefined): ResultItem[] {
  if (!data) return []
  const items: ResultItem[] = []

  for (const user of data.users) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    items.push({
      type: 'user',
      id: `user-${user.id}`,
      label: name,
      sublabel: user.jobTitle || user.email,
      href: `/settings?tab=members&userId=${user.id}`,
    })
  }

  for (const event of data.events) {
    const date = new Date(event.startTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    items.push({
      type: 'event',
      id: `event-${event.id}`,
      label: event.title,
      sublabel: `${date} - ${event.calendar.name}`,
      href: `/calendar?eventId=${event.id}`,
    })
  }

  for (const ticket of data.tickets) {
    items.push({
      type: 'ticket',
      id: `ticket-${ticket.id}`,
      label: ticket.title,
      sublabel: `${ticket.status} - ${ticket.priority}`,
      href: `/tickets?id=${ticket.id}`,
    })
  }

  for (const loc of data.locations) {
    items.push({
      type: 'location',
      id: `location-${loc.id}`,
      label: loc.name,
      sublabel: 'Building',
      href: `/settings?tab=campus&buildingId=${loc.id}`,
    })
  }

  return items
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'user':
      return <User className="w-4 h-4 text-gray-400" />
    case 'event':
      return <Calendar className="w-4 h-4 text-gray-400" />
    case 'ticket':
      return <Ticket className="w-4 h-4 text-gray-400" />
    case 'location':
      return <MapPin className="w-4 h-4 text-gray-400" />
    default:
      return <Search className="w-4 h-4 text-gray-400" />
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'user':
      return 'People'
    case 'event':
      return 'Events'
    case 'ticket':
      return 'Tickets'
    case 'location':
      return 'Locations'
    default:
      return ''
  }
}

export default function SearchCommand({ isOpen, onClose }: SearchCommandProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useGlobalSearch(debouncedQuery)
  const items = flattenResults(data)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setDebouncedQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [items.length])

  const navigate = useCallback(
    (href: string) => {
      onClose()
      window.location.href = href
    },
    [onClose]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      }
      if (e.key === 'Enter' && items[activeIndex]) {
        e.preventDefault()
        navigate(items[activeIndex].href)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, items, activeIndex, navigate, onClose])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
      activeEl?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  if (!isOpen) return null

  // Group items by type for section headers
  const grouped: { type: string; items: (ResultItem & { globalIndex: number })[] }[] = []
  let currentType = ''
  items.forEach((item, i) => {
    if (item.type !== currentType) {
      currentType = item.type
      grouped.push({ type: item.type, items: [] })
    }
    grouped[grouped.length - 1].items.push({ ...item, globalIndex: i })
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-lg bg-white rounded-xl shadow-heavy overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, events, tickets, locations..."
              className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto">
            {debouncedQuery.length < 2 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Type to search...
              </div>
            ) : isLoading ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Searching...
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No results found
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.type}>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                      {getTypeLabel(group.type)}
                    </span>
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      data-index={item.globalIndex}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIndex(item.globalIndex)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                        item.globalIndex === activeIndex
                          ? 'bg-primary-50 text-primary-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex-shrink-0">{getTypeIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        {item.sublabel && (
                          <p className="text-xs text-gray-400 truncate">{item.sublabel}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">&uarr;</kbd>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">&darr;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">&crarr;</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
