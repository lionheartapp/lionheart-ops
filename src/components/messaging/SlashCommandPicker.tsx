'use client'

/**
 * SlashCommandPicker — dropdown for inserting ticket/event references via /.
 *
 * Two-level menu:
 * 1. Type selection: IT Tickets, Maintenance Tickets, Events
 * 2. Search within selected type, showing results the user is connected to
 *
 * Inserts a reference chip into the editor when an item is selected.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Wrench, Monitor, CalendarDays, ArrowLeft, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferenceItem {
  id: string
  title: string
  status: string
  type: string
  priority?: string
  category?: string
  startsAt?: string
  createdAt?: string
}

interface SlashCommandPickerProps {
  onSelect: (item: ReferenceItem) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 'it', label: 'IT Tickets', icon: Monitor, description: 'Search your IT tickets' },
  { id: 'maintenance', label: 'Maintenance Tickets', icon: Wrench, description: 'Search your maintenance tickets' },
  { id: 'event', label: 'Events', icon: CalendarDays, description: 'Search your events' },
]

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SlashCommandPicker({ onSelect, onClose }: SlashCommandPickerProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Fetch results when type is selected
  useEffect(() => {
    if (!selectedType) return
    setLoading(true)
    setSelectedIndex(0)

    const controller = new AbortController()
    const params = new URLSearchParams({ type: selectedType, limit: '10' })
    if (search) params.set('search', search)

    fetch(`/api/messaging/references?${params}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        setResults(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    return () => controller.abort()
  }, [selectedType, search])

  // Focus search when entering a category
  useEffect(() => {
    if (selectedType) setTimeout(() => searchRef.current?.focus(), 50)
  }, [selectedType])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = selectedType ? results : CATEGORIES
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i + items.length - 1) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!selectedType) {
        setSelectedType(CATEGORIES[selectedIndex]?.id ?? null)
      } else if (results[selectedIndex]) {
        onSelect(results[selectedIndex])
      }
    } else if (e.key === 'Backspace' && selectedType && search === '') {
      setSelectedType(null)
      setResults([])
    }
  }, [selectedType, results, selectedIndex, search, onSelect])

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // --- Category selection ---
  if (!selectedType) {
    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className="bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-72 outline-none"
      >
        <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
          Insert reference
        </div>
        {CATEGORIES.map((cat, i) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedType(cat.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors ${
                i === selectedIndex ? 'bg-primary-50' : 'hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{cat.label}</p>
                <p className="text-xs text-slate-400">{cat.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // --- Search within category ---
  const activeCat = CATEGORIES.find((c) => c.id === selectedType)

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className="bg-white border border-slate-200 rounded-xl shadow-lg w-80 outline-none"
    >
      {/* Header with back button */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <button
          type="button"
          onClick={() => { setSelectedType(null); setSearch(''); setResults([]) }}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-slate-700">{activeCat?.label}</span>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        {/* eslint-disable-next-line no-restricted-syntax -- Inline search within picker */}
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeCat?.label?.toLowerCase()}...`}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Results */}
      <div className="max-h-[240px] overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 text-center">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : results.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-400 text-center">
            {search ? 'No results found' : 'No items to show'}
          </p>
        ) : (
          results.map((item, i) => {
            const statusClass = STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-600'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer transition-colors ${
                  i === selectedIndex ? 'bg-primary-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusClass}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.type === 'event' ? formatDate(item.startsAt) : formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
