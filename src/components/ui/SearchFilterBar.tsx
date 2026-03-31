'use client'

import { ReactNode } from 'react'
import { Search, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterTab {
  label: string
  value: string
  count?: number
}

export interface SearchFilterBarProps {
  /** Search query value (controlled) */
  search: string
  /** Called when search changes */
  onSearchChange: (value: string) => void
  /** Placeholder for search input */
  searchPlaceholder?: string
  /** Filter tabs (e.g. status tabs: All, Active, Inactive) */
  tabs?: FilterTab[]
  /** Currently active tab value */
  activeTab?: string
  /** Called when a tab is clicked */
  onTabChange?: (value: string) => void
  /** Right-side action buttons */
  actions?: ReactNode
  /** Additional filter controls (rendered between search and actions) */
  filters?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  tabs,
  activeTab,
  onTabChange,
  actions,
  filters,
}: SearchFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Tabs row */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-slate-200 -mx-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange?.(tab.value)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.value
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 text-xs text-slate-400">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search + filters + actions row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-full placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Extra filters */}
        {filters}

        {/* Action buttons */}
        {actions}
      </div>
    </div>
  )
}
