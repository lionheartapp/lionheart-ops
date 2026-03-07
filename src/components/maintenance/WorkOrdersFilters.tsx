'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, SlidersHorizontal, ChevronDown, Check } from 'lucide-react'
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

const inputClass = 'ui-input !w-full !py-2'

// ─── Custom filter dropdown ─────────────────────────────────────────────────

interface FilterDropdownProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  allLabel: string
  ariaLabel: string
}

function FilterDropdown({ label, value, options, onChange, allLabel, ariaLabel }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label ?? value
    : allLabel

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleClickOutside, handleKeyDown])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
          value
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white/60 backdrop-blur-sm text-gray-700 border-gray-200/60 hover:bg-white/80 hover:border-gray-300'
        }`}
      >
        {value ? selectedLabel : label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] ui-glass-dropdown p-1 animate-[fadeIn_100ms_ease-out]">
          {/* All / reset option */}
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
              !value ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {allLabel}
            {!value && <Check className="w-3.5 h-3.5 text-gray-900" />}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                value === o.value ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {o.label}
              {value === o.value && <Check className="w-3.5 h-3.5 text-gray-900" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

function getActiveFilterLabels(filters: WorkOrdersFilterState): string[] {
  const labels: string[] = []
  if (filters.status) {
    labels.push(STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status)
  }
  if (filters.priority) {
    labels.push(PRIORITY_OPTIONS.find((o) => o.value === filters.priority)?.label ?? filters.priority)
  }
  if (filters.category) {
    labels.push(CATEGORY_OPTIONS.find((o) => o.value === filters.category)?.label ?? filters.category)
  }
  if (filters.assignedToId) labels.push('Technician')
  if (filters.search) labels.push(`"${filters.search}"`)
  if (filters.unassigned) labels.push('Unassigned')
  return labels
}

export default function WorkOrdersFilters({
  filters,
  onChange,
  technicians,
}: WorkOrdersFiltersProps) {
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localSearchRef = useRef(filters.search)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)

  // Sync local search ref when filters change from parent (e.g. clear)
  useEffect(() => {
    localSearchRef.current = filters.search
  }, [filters.search])

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

  function clearFilters() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    localSearchRef.current = ''
    const searchInput = document.getElementById('wo-search') as HTMLInputElement | null
    if (searchInput) searchInput.value = ''
    onChange({ ...DEFAULT_FILTERS, schoolId: filters.schoolId })
  }

  const active = hasActiveFilters(filters)
  const activeCount = getActiveFilterLabels(filters).length
  const activeLabels = getActiveFilterLabels(filters)

  return (
    <>
      {/* ─── Desktop: inline filters (hidden on mobile) ─── */}
      <div className="hidden lg:flex flex-wrap items-center gap-2 pb-3">
        {/* Status */}
        <FilterDropdown
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(v) => update({ status: v as MaintenanceStatus | '' })}
          allLabel="All Statuses"
          ariaLabel="Filter by status"
        />

        {/* Priority */}
        <FilterDropdown
          label="Priority"
          value={filters.priority}
          options={PRIORITY_OPTIONS}
          onChange={(v) => update({ priority: v as MaintenancePriority | '' })}
          allLabel="All Priorities"
          ariaLabel="Filter by priority"
        />

        {/* Category */}
        <FilterDropdown
          label="Category"
          value={filters.category}
          options={CATEGORY_OPTIONS}
          onChange={(v) => update({ category: v as MaintenanceCategory | '' })}
          allLabel="All Categories"
          ariaLabel="Filter by category"
        />

        {/* Technician */}
        {technicians.length > 0 && (
          <FilterDropdown
            label="Technician"
            value={filters.assignedToId}
            options={technicians.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
            onChange={(v) => update({ assignedToId: v })}
            allLabel="All Technicians"
            ariaLabel="Filter by technician"
          />
        )}

        {/* Keyword search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            id="wo-search"
            type="text"
            defaultValue={filters.search}
            onChange={handleSearchChange}
            placeholder="Search tickets..."
            className={`${inputClass} pl-8`}
            aria-label="Search work orders"
          />
        </div>

        {/* Unassigned toggle */}
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={filters.unassigned}
            onChange={(e) => update({ unassigned: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus-visible:ring-gray-400 cursor-pointer"
          />
          Unassigned only
        </label>

        {/* Clear filters */}
        {active && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Clear all filters"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ─── Mobile: filter chips + "Filters" button (hidden on desktop) ─── */}
      <div className="flex lg:hidden items-center gap-2 pb-3 overflow-x-auto">
        {/* Filters button */}
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

        {/* Active filter chips */}
        {activeLabels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-700 bg-gray-100 rounded-full flex-shrink-0"
          >
            {label}
            <button
              onClick={() => {
                // Remove this specific filter
                if (filters.status && (STATUS_OPTIONS.find((o) => o.value === filters.status)?.label === label)) {
                  update({ status: '' })
                } else if (filters.priority && (PRIORITY_OPTIONS.find((o) => o.value === filters.priority)?.label === label)) {
                  update({ priority: '' })
                } else if (filters.category && (CATEGORY_OPTIONS.find((o) => o.value === filters.category)?.label === label)) {
                  update({ category: '' })
                } else if (label === 'Technician') {
                  update({ assignedToId: '' })
                } else if (label === 'Unassigned') {
                  update({ unassigned: false })
                } else if (label.startsWith('"')) {
                  update({ search: '' })
                }
              }}
              className="hover:text-gray-900 cursor-pointer"
              aria-label={`Remove ${label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Clear all on mobile */}
        {active && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer"
          >
            Clear all
          </button>
        )}
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
