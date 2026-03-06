'use client'

import { useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'
import { useCampusLocations } from '@/lib/hooks/useCampusLocations'
import { FloatingDropdown } from '@/components/ui/FloatingInput'

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
    <div className="flex flex-wrap items-end gap-x-2 gap-y-4 pb-3 pt-2">
      {/* Category */}
      <FloatingDropdown
        label="Category"
        value={filters.category}
        onChange={(v) => update({ category: v as AssetCategoryFilter })}
        options={[
          { value: '', label: 'All Categories' },
          ...CATEGORY_OPTIONS,
        ]}
        className="min-w-[150px]"
      />

      {/* Building */}
      {buildingOptions.length > 0 && (
        <FloatingDropdown
          label="Building"
          value={filters.buildingId}
          onChange={(v) => update({ buildingId: v, areaId: '', roomId: '' })}
          options={[
            { value: '', label: 'All Buildings' },
            ...buildingOptions,
          ]}
          className="min-w-[150px]"
        />
      )}

      {/* Status */}
      <FloatingDropdown
        label="Status"
        value={filters.status}
        onChange={(v) => update({ status: v as AssetStatusFilter })}
        options={[
          { value: '', label: 'All Statuses' },
          ...STATUS_OPTIONS,
        ]}
        className="min-w-[140px]"
      />

      {/* Warranty Status */}
      <FloatingDropdown
        label="Warranty"
        value={filters.warrantyStatus}
        onChange={(v) => update({ warrantyStatus: v as WarrantyStatusFilter })}
        options={[
          { value: '', label: 'Any Warranty' },
          ...WARRANTY_OPTIONS,
        ]}
        className="min-w-[160px]"
      />

      {/* Sort */}
      <FloatingDropdown
        label="Sort By"
        value={filters.sortField}
        onChange={(v) => update({ sortField: v as AssetSortField })}
        options={SORT_OPTIONS}
        className="min-w-[150px]"
      />

      {/* Sort direction */}
      <FloatingDropdown
        label="Direction"
        value={filters.sortDir}
        onChange={(v) => update({ sortDir: v as AssetSortDir })}
        options={[
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ]}
        className="min-w-[130px]"
      />

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
