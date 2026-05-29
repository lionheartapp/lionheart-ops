'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import { Checkbox } from '@/components/ui/Checkbox'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select, type SelectOption } from '@/components/ui/Select'
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
  const [localSearch, setLocalSearch] = useState(filters.search)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  // Sync local search ref when filters change from parent (e.g. clear)
  useEffect(() => {
    setLocalSearch(filters.search)
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

  const update = useCallback((patch: Partial<WorkOrdersFilterState>) => {
    onChange({ ...filters, ...patch })
  }, [filters, onChange])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setLocalSearch(value)

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      update({ search: value })
    }, 300)
  }

  const handleSearchClear = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setLocalSearch('')
    update({ search: '' })
  }, [update])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleSearchClear()
    }
  }

  function clearFilters() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setLocalSearch('')
    onChange({ ...DEFAULT_FILTERS, schoolId: filters.schoolId })
  }

  function clearDropdownFilters() {
    onChange({ ...filters, status: '', priority: '', category: '', assignedToId: '', unassigned: false })
  }

  const dropdownFilterCount = countActiveDropdownFilters(filters)
  const statusSelectOptions: SelectOption<MaintenanceStatus | ''>[] = [
    { value: '', label: 'All Statuses' },
    ...STATUS_OPTIONS,
  ]
  const prioritySelectOptions: SelectOption<MaintenancePriority | ''>[] = [
    { value: '', label: 'All Priorities' },
    ...PRIORITY_OPTIONS,
  ]
  const categorySelectOptions: SelectOption<MaintenanceCategory | ''>[] = [
    { value: '', label: 'All Categories' },
    ...CATEGORY_OPTIONS,
  ]
  const technicianSelectOptions: SelectOption[] = [
    { value: '', label: 'All Technicians' },
    ...technicians.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` })),
  ]

  // ─── "My Board" — search only, no filters ───────────────────────────────────
  if (boardView === 'my-board') {
    return (
      <div className="pb-2 max-w-[768px]">
        <SearchInput
          id="wo-search"
          value={localSearch}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          onClear={handleSearchClear}
          placeholder="Search tickets..."
          aria-label="Search work orders"
          className="rounded-full"
        />
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
          <div className="flex-1 max-w-[768px]">
            <SearchInput
              id="wo-search"
              value={localSearch}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onClear={handleSearchClear}
              placeholder="Search tickets..."
              aria-label="Search work orders"
              className="rounded-full"
            />
          </div>

          {/* Filter button */}
          <div className="relative flex-shrink-0">
            <button
              ref={filterBtnRef}
              onClick={() => setFilterPopoverOpen((o) => !o)}
              className={`inline-flex items-center gap-2 h-[52px] px-5 text-sm font-medium rounded-full border transition-all duration-200 cursor-pointer ${
                filterPopoverOpen || dropdownFilterCount > 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {dropdownFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-white text-slate-900 rounded-full">
                  {dropdownFilterCount}
                </span>
              )}
            </button>

            {/* Filter popover */}
            {filterPopoverOpen && (
              <div
                ref={filterPopoverRef}
                className="absolute right-0 top-full mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-5 space-y-4"
              >
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                  <Select<MaintenanceStatus | ''>
                    value={filters.status}
                    onChange={(value) => update({ status: value })}
                    options={statusSelectOptions}
                    size="sm"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Priority</label>
                  <Select<MaintenancePriority | ''>
                    value={filters.priority}
                    onChange={(value) => update({ priority: value })}
                    options={prioritySelectOptions}
                    size="sm"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                  <Select<MaintenanceCategory | ''>
                    value={filters.category}
                    onChange={(value) => update({ category: value })}
                    options={categorySelectOptions}
                    size="sm"
                  />
                </div>

                {/* Technician */}
                {technicians.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Technician</label>
                    <Select
                      value={filters.assignedToId}
                      onChange={(value) => update({ assignedToId: value })}
                      options={technicianSelectOptions}
                      size="sm"
                    />
                  </div>
                )}

                {/* Unassigned only toggle */}
                <Checkbox
                  checked={filters.unassigned}
                  onChange={(e) => update({ unassigned: e.target.checked })}
                  label="Unassigned only"
                  className="pt-1"
                />

                {/* Clear / Apply row */}
                {dropdownFilterCount > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={clearDropdownFilters}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
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
          <div className="flex-1 min-w-0">
            <SearchInput
              value={localSearch}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onClear={handleSearchClear}
              placeholder="Search tickets..."
              aria-label="Search work orders"
              className="h-10 rounded-full"
            />
          </div>
          <button
            onClick={() => setBottomSheetOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-3 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {dropdownFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-slate-900 rounded-full">
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
          <SearchInput
            id="wo-search"
            value={localSearch}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onClear={handleSearchClear}
            placeholder="Search tickets..."
            aria-label="Search work orders"
            size="sm"
          />
        </div>
        <Checkbox
          checked={filters.unassigned}
          onChange={(e) => update({ unassigned: e.target.checked })}
          label="Unassigned only"
          className="pb-2.5 whitespace-nowrap"
        />
        {active && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 mb-0.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-slate-900 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
        {activeLabels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-700 bg-slate-100 rounded-full flex-shrink-0"
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
              className="hover:text-slate-900 cursor-pointer"
              aria-label={`Remove ${label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {active && (
          <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0 cursor-pointer">
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
