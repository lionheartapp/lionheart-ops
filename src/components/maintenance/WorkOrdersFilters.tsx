'use client'

import { useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'

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

interface Campus {
  id: string
  name: string
}

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface WorkOrdersFiltersProps {
  filters: WorkOrdersFilterState
  onChange: (filters: WorkOrdersFilterState) => void
  campuses: Campus[]
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

const selectClass =
  'px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer transition-colors'

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-colors'

function hasActiveFilters(filters: WorkOrdersFilterState): boolean {
  return (
    filters.status !== '' ||
    filters.priority !== '' ||
    filters.category !== '' ||
    filters.schoolId !== '' ||
    filters.assignedToId !== '' ||
    filters.search !== '' ||
    filters.unassigned
  )
}

export default function WorkOrdersFilters({
  filters,
  onChange,
  campuses,
  technicians,
}: WorkOrdersFiltersProps) {
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localSearchRef = useRef(filters.search)

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
    onChange({ ...DEFAULT_FILTERS })
  }

  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as MaintenanceStatus | '' })}
        className={selectClass}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={(e) => update({ priority: e.target.value as MaintenancePriority | '' })}
        className={selectClass}
        aria-label="Filter by priority"
      >
        <option value="">All Priorities</option>
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category}
        onChange={(e) => update({ category: e.target.value as MaintenanceCategory | '' })}
        className={selectClass}
        aria-label="Filter by category"
      >
        <option value="">All Categories</option>
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Campus */}
      {campuses.length > 0 && (
        <select
          value={filters.schoolId}
          onChange={(e) => update({ schoolId: e.target.value })}
          className={selectClass}
          aria-label="Filter by campus"
        >
          <option value="">All Campuses</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* Technician */}
      {technicians.length > 0 && (
        <select
          value={filters.assignedToId}
          onChange={(e) => update({ assignedToId: e.target.value })}
          className={selectClass}
          aria-label="Filter by technician"
        >
          <option value="">All Technicians</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>
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
          className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400 cursor-pointer"
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
  )
}
