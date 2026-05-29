'use client'

/**
 * SearchPanel -- Cmd+K style overlay for full-text message search.
 *
 * Centered modal with search input, scrollable results, infinite "load more".
 * Closes on Escape, backdrop click, or result selection.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { Search, X, Hash, Loader2 } from 'lucide-react'
import { useMessageSearch } from '@/lib/hooks/useMessageSearch'
import { Input } from '@/components/ui/Input'
import type { SearchResult } from '@/lib/hooks/useMessageSearch'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchPanelProps {
  onClose: () => void
  onNavigate: (channelId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate content to roughly N characters at a word boundary. */
function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  const truncated = text.slice(0, max)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? truncated.slice(0, lastSpace) : truncated) + '...'
}

/** Relative date label (e.g. "2m ago", "3h ago", "Jan 5"). */
function relativeDate(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** User avatar or fallback initial. */
function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <OptimizedImage
        src={url}
        alt={name}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  const initial = (name[0] ?? '?').toUpperCase()
  return (
    <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
      {initial}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="px-4 py-3 flex gap-3 animate-pulse">
      <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 bg-slate-200 rounded" />
        <div className="h-3 w-full bg-slate-100 rounded" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultRow({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: (channelId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result.channelId)}
      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors duration-200 cursor-pointer flex gap-3"
    >
      <Avatar name={result.authorName} url={result.authorAvatar} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-slate-700 truncate">
            {result.authorName}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400 flex-shrink-0">
            <Hash className="w-3 h-3" />
            {result.channelName}
          </span>
          <span className="text-[10px] text-slate-300 flex-shrink-0 ml-auto">
            {relativeDate(result.createdAt)}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed truncate">
          {truncate(result.content)}
        </p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchPanel({ onClose, onNavigate }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const {
    results,
    hasMore,
    fetchNextPage,
    isLoading,
    isFetchingNextPage,
    debouncedQuery,
  } = useMessageSearch(query)

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose],
  )

  const handleSelect = useCallback(
    (channelId: string) => {
      onNavigate(channelId)
      onClose()
    },
    [onNavigate, onClose],
  )

  const showEmpty = debouncedQuery.length < 2
  const showNoResults =
    !showEmpty && !isLoading && results.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            size="sm"
            className="h-auto min-h-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:ring-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors duration-200"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">
          {/* Empty state: no query yet */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-8 h-8 mb-2" />
              <p className="text-sm">Search messages across your channels</p>
              <p className="text-xs mt-1 text-slate-300">
                Type at least 2 characters to search
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !showEmpty && (
            <div>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p className="text-sm">
                No messages found for &ldquo;{debouncedQuery}&rdquo;
              </p>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="divide-y divide-slate-100">
              {results.map((r) => (
                <ResultRow key={r.id} result={r} onSelect={handleSelect} />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer transition-colors duration-200 disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load more results'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-400 flex items-center gap-4">
          <span>
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Esc</kbd> to close
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Enter</kbd> to select
          </span>
        </div>
      </div>
    </div>
  )
}
