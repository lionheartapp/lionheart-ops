'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationProps {
  /** Current page (1-based) */
  page: number
  /** Total number of pages */
  totalPages: number
  /** Total number of items */
  total: number
  /** Called when page changes */
  onPageChange: (page: number) => void
  /** Items per page (for "showing X-Y of Z" label) */
  limit: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  limit,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-slate-400">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>

        {/* Page numbers — show up to 5 pages centered around current */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => {
            if (totalPages <= 5) return true
            if (p === 1 || p === totalPages) return true
            return Math.abs(p - page) <= 1
          })
          .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
            if (i > 0 && typeof arr[i - 1] === 'number' && p - (arr[i - 1] as number) > 1) {
              acc.push('ellipsis')
            }
            acc.push(p)
            return acc
          }, [])
          .map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`e${i}`} className="px-1.5 text-slate-400 text-sm">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item as number)}
                className={`min-w-[32px] h-8 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  page === item
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            )
          )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  )
}
