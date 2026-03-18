'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'

export interface FilterField {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

interface ITSearchFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters: FilterField[]
  /** Extra element rendered after the filter button (e.g. "New Request" button) */
  trailing?: ReactNode
}

export default function ITSearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  trailing,
}: ITSearchFilterBarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = filters.filter((f) => f.value !== '').length

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  const clearAll = () => {
    filters.forEach((f) => f.onChange(''))
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex items-center gap-3 pb-2">
        {/* Pill search bar */}
        <div className="group relative flex-1 max-w-[768px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-[52px] pl-14 pr-12 text-base text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-full focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition-all duration-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter button */}
        {filters.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              ref={btnRef}
              onClick={() => setPopoverOpen((o) => !o)}
              className={`inline-flex items-center gap-2 h-[52px] px-5 text-sm font-medium rounded-full border transition-all duration-200 cursor-pointer ${
                popoverOpen || activeFilterCount > 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-white text-slate-900 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter popover */}
            {popoverOpen && (
              <div
                ref={popoverRef}
                className="absolute right-0 top-full mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-5 space-y-4"
              >
                {filters.map((f) => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      {f.label}
                    </label>
                    <select
                      value={f.value}
                      onChange={(e) => f.onChange(e.target.value)}
                      className="w-full h-10 px-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {activeFilterCount > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={clearAll}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {trailing}
      </div>

      {/* Mobile */}
      <div className="flex lg:hidden items-center gap-2 pb-3">
        <div className="group relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-10 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all duration-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {filters.length > 0 && (
          <button
            onClick={() => setPopoverOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 h-10 px-3 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-slate-900 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
        {trailing}
      </div>
    </>
  )
}
