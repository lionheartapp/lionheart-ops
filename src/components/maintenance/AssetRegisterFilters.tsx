'use client'

import { useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'
import { useCampusLocations } from '@/lib/hooks/useCampusLocations'

export type AssetStatusFilter = 'ACTIVE' | 'INACTIVE' | 'DECOMMISSIONED' | 'PENDING_DISPOSAL' | ''
export type AssetCategoryFilter =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'HVAC'
  | 'STRUCTURAL'
  | 'CUSTODIAL_BIOHAZARD'
  | 'GROUNDS'
  | 'IT_AV'
  | 'OTHER'
  | ''

export type WarrantyStatusFilter = 'active' | 'expiring_soon' | 'expired' | 'none' | ''

export type AssetSortField = 'assetNumber' | 'name' | 'category' | 'warrantyExpiry' | 'replacementCost'
export type AssetSortDir = 'asc' | 'desc'

export interface AssetFilterState {
  category: AssetCategoryFilter
  buildingId: string
  areaId: string
  roomId: string
  status: AssetStatusFilter
  warrantyStatus: WarrantyStatusFilter
  search: string
  sortField: AssetSortField
  sortDir: AssetSortDir
}

export const DEFAULT_ASSET_FILTERS: AssetFilterState = {
  category: '',
  buildingId: '',
  areaId: '',
  roomId: '',
  status: '',
  warrantyStatus: '',
  search: '',
  sortField: 'assetNumber',
  sortDir: 'asc',
}

interface AssetRegisterFiltersProps {
  filters: AssetFilterState
  onChange: (filters: AssetFilterState) => void
}

const CATEGORY_OPTIONS: { value: AssetCategoryFilter; label: string }[] = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial / Biohazard' },
  { value: 'GROUNDS', label: 'Grounds' },
  { value: 'IT_AV', label: 'IT / AV' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_OPTIONS: { value: AssetStatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
  { value: 'PENDING_DISPOSAL', label: 'Pending Disposal' },
]

const WARRANTY_OPTIONS: { value: WarrantyStatusFilter; label: string }[] = [
  { value: 'active', label: 'Active Warranty' },
  { value: 'expiring_soon', label: 'Expiring Soon (<90d)' },
  { value: 'expired', label: 'Expired' },
  { value: 'none', label: 'No Warranty' },
]

const SORT_OPTIONS: { value: AssetSortField; label: string }[] = [
  { value: 'assetNumber', label: 'Asset Number' },
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'warrantyExpiry', label: 'Warranty Expiry' },
  { value: 'replacementCost', label: 'Replacement Cost' },
]

const selectClass =
  'px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer transition-colors'

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-colors'

function hasActiveFilters(filters: AssetFilterState): boolean {
  return (
    filters.category !== '' ||
    filters.buildingId !== '' ||
    filters.areaId !== '' ||
    filters.roomId !== '' ||
    filters.status !== '' ||
    filters.warrantyStatus !== '' ||
    filters.search !== '' ||
    filters.sortField !== DEFAULT_ASSET_FILTERS.sortField ||
    filters.sortDir !== DEFAULT_ASSET_FILTERS.sortDir
  )
}

export default function AssetRegisterFilters({
  filters,
  onChange,
}: AssetRegisterFiltersProps) {
  const { data: locationOptions = [] } = useCampusLocations()
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localSearchRef = useRef(filters.search)

  useEffect(() => {
    localSearchRef.current = filters.search
  }, [filters.search])

  function update(patch: Partial<AssetFilterState>) {
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
    const searchInput = document.getElementById('asset-search') as HTMLInputElement | null
    if (searchInput) searchInput.value = ''
    onChange({ ...DEFAULT_ASSET_FILTERS })
  }

  // Build building options (unique buildings from location options)
  const buildingOptions = locationOptions
    .filter((o) => o.type === 'building')
    .map((o) => ({ value: o.buildingId!, label: o.label }))

  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      {/* Category */}
      <select
        value={filters.category}
        onChange={(e) => update({ category: e.target.value as AssetCategoryFilter })}
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

      {/* Building */}
      {buildingOptions.length > 0 && (
        <select
          value={filters.buildingId}
          onChange={(e) => update({ buildingId: e.target.value, areaId: '', roomId: '' })}
          className={selectClass}
          aria-label="Filter by building"
        >
          <option value="">All Buildings</option>
          {buildingOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as AssetStatusFilter })}
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

      {/* Warranty Status */}
      <select
        value={filters.warrantyStatus}
        onChange={(e) => update({ warrantyStatus: e.target.value as WarrantyStatusFilter })}
        className={selectClass}
        aria-label="Filter by warranty status"
      >
        <option value="">Any Warranty</option>
        {WARRANTY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Sort */}
      <select
        value={filters.sortField}
        onChange={(e) => update({ sortField: e.target.value as AssetSortField })}
        className={selectClass}
        aria-label="Sort by"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Sort direction */}
      <select
        value={filters.sortDir}
        onChange={(e) => update({ sortDir: e.target.value as AssetSortDir })}
        className={selectClass}
        aria-label="Sort direction"
      >
        <option value="asc">Asc</option>
        <option value="desc">Desc</option>
      </select>

      {/* Keyword search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          id="asset-search"
          type="text"
          defaultValue={filters.search}
          onChange={handleSearchChange}
          placeholder="Search assets..."
          className={`${inputClass} pl-8`}
          aria-label="Search assets"
        />
      </div>

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
