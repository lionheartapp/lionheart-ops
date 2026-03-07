'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, SlidersHorizontal, ChevronDown, Check } from 'lucide-react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import FilterBottomSheet from './FilterBottomSheet'

export type MaintenanceStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'SCHEDULED'
  | 'QA'
  | 'DONE'
  | 'CANCELLED'

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type MaintenanceCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'HVAC'
  | 'STRUCTURAL'
  | 'CUSTODIAL_BIOHAZARD'
  | 'GROUNDS'
  | 'IT_AV'
  | 'OTHER'

export interface WorkOrdersFilterState {
  status: MaintenanceStatus | ''
  priority: MaintenancePriority | ''
  category: MaintenanceCategory | ''
  schoolId: string
  assignedToId: string
  search: string
  unassigned: boolean
}

export const DEFAULT_FILTERS: WorkOrdersFilterState = {
  status: '',
  priority: '',
  category: '',
  schoolId: '',
  assignedToId: '',
  search: '',
  unassigned: false,
}

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface WorkOrdersFiltersProps {
  filters: WorkOrdersFilterState
  onChange: (filters: WorkOrdersFilterState) => void
  technicians: Technician[]
  boardView?: 'my-board' | 'team-board'
}

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'QA', label: 'QA' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial / Biohazard' },
  { value: 'GROUNDS', label: 'Grounds' },
  { value: 'IT_AV', label: 'IT / AV' },
  { value: 'OTHER', label: 'Other' },
]

export function hasActiveFilters(filters: WorkOrdersFilterState): boolean {
  return (
    filters.status !== '' ||
    filters.priority !== '' ||
    filters.category !== '' ||
    filters.assignedToId !== '' ||
    filters.search !== '' ||
    filters.unassigned
  )
}

/** Count of active non-search filters (for the filter button badge) */
function countActiveDropdownFilters(filters: WorkOrdersFilterState): number {
  let count = 0
  if (filters.status) count++
  if (filters.priority) count++
  if (filters.category) count++
  if (filters.assignedToId) count++
  if (filters.unassigned) count++
  return count
}

export default function WorkOrdersFilters({
  filters,
  onChange,
  technicians,
  boardView,
}: WorkOrdersFiltersProps) {
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localSearchRef = useRef(filters.search)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  // Sync local search ref when filters change from parent (e.g. clear)
  useEffect(() => {
    localSearchRef.current = filters.search
  }, [filters.search])

  // Close popover on outside click
  useEffect(() => {
    if (!filterPopoverOpen) return
    function handleClick(e: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setFilterPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterPopoverOpen])

  function update(patch: Partial<WorkOrdersFilterState>) {
    onChange({ ...filters, ...patch })
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    localSearchRef.current = value

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      update({ search: value })
    }, 300)
  }

  const handleSearchClear = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    localSearchRef.current = ''
    const searchInput = document.getElementById('wo-search') as HTMLInputElement | null
    if (searchInput) searchInput.value = ''
    update({ search: '' })
  }, [filters])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleSearchClear()
    }
  }

  function clearFilters() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    localSearchRef.current = ''
    const searchInput = document.getElementById('wo-search') as HTMLInputElement | null
    if (searchInput) searchInput.value = ''
    onChange({ ...DEFAULT_FILTERS, schoolId: filters.schoolId })
  }

  function clearDropdownFilters() {
    onChange({ ...filters, status: '', priority: '', category: '', assignedToId: '', unassigned: false })
  }

  const dropdownFilterCount = countActiveDropdownFilters(filters)

  // ─── "My Board" — search only, no filters ───────────────────────────────────
  if (boardView === 'my-board') {
    return (
      <div className="group relative pb-2 max-w-[768px]">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5" style={{ top: 0, bottom: '0.5rem' }}>
          <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
        </div>
        <input
          id="wo-search"
          type="search"
          defaultValue={filters.search}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search tickets..."
          className="w-full h-[52px] pl-14 pr-12 text-base text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-full focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition-all duration-200"
          aria-label="Search work orders"
        />
        {filters.search && (
          <button
            type="button"
            onClick={handleSearchClear}
            className="absolute right-0 flex items-center pr-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            style={{ top: 0, bottom: '0.5rem', display: 'flex', alignItems: 'center' }}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // ─── "Team Board" — search bar + single filter button ────────────────────────
  if (boardView === 'team-board') {
    return (
      <>
        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-3 pb-2">
          {/* KB-style search bar */}
          <div className="group relative flex-1 max-w-[768px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
            </div>
            <input
              id="wo-search"
              type="search"
              defaultValue={filters.search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search tickets..."
              className="w-full h-[52px] pl-14 pr-12 text-base text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-full focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition-all duration-200"
              aria-label="Search work orders"
            />
            {filters.search && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute inset-y-0 right-0 flex items-center pr-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter button */}
          <div className="relative flex-shrink-0">
            <button
              ref={filterBtnRef}
              onClick={() => setFilterPopoverOpen((o) => !o)}
              className={`inline-flex items-center gap-2 h-[52px] px-5 text-sm font-medium rounded-full border transition-all duration-200 cursor-pointer ${
                filterPopoverOpen || dropdownFilterCount > 0
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {dropdownFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-white text-gray-900 rounded-full">
                  {dropdownFilterCount}
                </span>
              )}
            </button>

            {/* Filter popover */}
            {filterPopoverOpen && (
              <div
                ref={filterPopoverRef}
                className="absolute right-0 top-full mt-2 w-[320px] bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-5 space-y-4"
              >
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => update({ status: e.target.value as MaintenanceStatus | '' })}
                    className="w-full h-10 px-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Priority</label>
                  <select
                    value={filters.priority}
                    onChange={(e) => update({ priority: e.target.value as MaintenancePriority | '' })}
                    className="w-full h-10 px-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
                  >
                    <option value="">All Priorities</option>
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => update({ category: e.target.value as MaintenanceCategory | '' })}
                    className="w-full h-10 px-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Technician */}
                {technicians.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Technician</label>
                    <select
                      value={filters.assignedToId}
                      onChange={(e) => update({ assignedToId: e.target.value })}
                      className="w-full h-10 px-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
                    >
                      <option value="">All Technicians</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Unassigned only toggle */}
                <label className="flex items-center gap-2.5 pt-1 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.unassigned}
                    onChange={(e) => update({ unassigned: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus-visible:ring-gray-400 cursor-pointer"
                  />
                  Unassigned only
                </label>

                {/* Clear / Apply row */}
                {dropdownFilterCount > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={clearDropdownFilters}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="flex lg:hidden items-center gap-2 pb-3">
          <div className="group relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
            </div>
            <input
              type="search"
              defaultValue={filters.search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search tickets..."
              className="w-full h-10 pl-10 pr-10 text-sm text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all duration-200"
              aria-label="Search work orders"
            />
          </div>
          <button
            onClick={() => setBottomSheetOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-3 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {dropdownFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-gray-900 rounded-full">
                {dropdownFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Mobile filter bottom sheet */}
        <FilterBottomSheet
          open={bottomSheetOpen}
          onClose={() => setBottomSheetOpen(false)}
          filters={filters}
          onChange={onChange}
          technicians={technicians}
        />
      </>
    )
  }

  // ─── Default fallback (no boardView passed — legacy inline filters) ──────────
  const active = hasActiveFilters(filters)
  const activeCount = (() => {
    let c = 0
    if (filters.status) c++
    if (filters.priority) c++
    if (filters.category) c++
    if (filters.assignedToId) c++
    if (filters.search) c++
    if (filters.unassigned) c++
    return c
  })()
  const activeLabels = (() => {
    const labels: string[] = []
    if (filters.status) labels.push(STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status)
    if (filters.priority) labels.push(PRIORITY_OPTIONS.find((o) => o.value === filters.priority)?.label ?? filters.priority)
    if (filters.category) labels.push(CATEGORY_OPTIONS.find((o) => o.value === filters.category)?.label ?? filters.category)
    if (filters.assignedToId) labels.push('Technician')
    if (filters.search) labels.push(`"${filters.search}"`)
    if (filters.unassigned) labels.push('Unassigned')
    return labels
  })()

  return (
    <>
      {/* ─── Desktop: inline filters (hidden on mobile) ─── */}
      <div className="hidden lg:flex flex-wrap items-end gap-x-2 gap-y-4 pb-3 pt-2">
        <FloatingDropdown
          label="Status"
          value={filters.status}
          onChange={(v) => update({ status: v as MaintenanceStatus | '' })}
          options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS]}
          className="min-w-[140px]"
        />
        <FloatingDropdown
          label="Priority"
          value={filters.priority}
          onChange={(v) => update({ priority: v as MaintenancePriority | '' })}
          options={[{ value: '', label: 'All Priorities' }, ...PRIORITY_OPTIONS]}
          className="min-w-[140px]"
        />
        <FloatingDropdown
          label="Category"
          value={filters.category}
          onChange={(v) => update({ category: v as MaintenanceCategory | '' })}
          options={[{ value: '', label: 'All Categories' }, ...CATEGORY_OPTIONS]}
          className="min-w-[150px]"
        />
        {technicians.length > 0 && (
          <FloatingDropdown
            label="Technician"
            value={filters.assignedToId}
            onChange={(v) => update({ assignedToId: v })}
            options={[{ value: '', label: 'All Technicians' }, ...technicians.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]}
            className="min-w-[150px]"
          />
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            id="wo-search"
            type="text"
            defaultValue={filters.search}
            onChange={handleSearchChange}
            placeholder="Search tickets..."
            className="ui-input pl-8"
            aria-label="Search work orders"
          />
        </div>
        <label className="flex items-center gap-1.5 pb-2.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={filters.unassigned}
            onChange={(e) => update({ unassigned: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus-visible:ring-gray-400 cursor-pointer"
          />
          Unassigned only
        </label>
        {active && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 mb-0.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Clear all filters"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ─── Mobile: filter chips + "Filters" button ─── */}
      <div className="flex lg:hidden items-center gap-2 pb-3 overflow-x-auto">
        <button
          onClick={() => setBottomSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-gray-900 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
        {activeLabels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-700 bg-gray-100 rounded-full flex-shrink-0"
          >
            {label}
            <button
              onClick={() => {
                if (filters.status && (STATUS_OPTIONS.find((o) => o.value === filters.status)?.label === label)) update({ status: '' })
                else if (filters.priority && (PRIORITY_OPTIONS.find((o) => o.value === filters.priority)?.label === label)) update({ priority: '' })
                else if (filters.category && (CATEGORY_OPTIONS.find((o) => o.value === filters.category)?.label === label)) update({ category: '' })
                else if (label === 'Technician') update({ assignedToId: '' })
                else if (label === 'Unassigned') update({ unassigned: false })
                else if (label.startsWith('"')) update({ search: '' })
              }}
              className="hover:text-gray-900 cursor-pointer"
              aria-label={`Remove ${label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {active && (
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer">
            Clear all
          </button>
        )}
      </div>

      <FilterBottomSheet
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        filters={filters}
        onChange={onChange}
        technicians={technicians}
      />
    </>
  )
}
