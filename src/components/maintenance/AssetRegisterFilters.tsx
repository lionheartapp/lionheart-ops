'use client'

import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useCampusLocations } from '@/lib/hooks/useCampusLocations'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'

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

function countActiveDropdownFilters(filters: AssetFilterState): number {
  let count = 0
  if (filters.category) count++
  if (filters.buildingId) count++
  if (filters.status) count++
  if (filters.warrantyStatus) count++
  if (filters.sortField !== DEFAULT_ASSET_FILTERS.sortField) count++
  if (filters.sortDir !== DEFAULT_ASSET_FILTERS.sortDir) count++
  return count
}

export default function AssetRegisterFilters({
  filters,
  onChange,
}: AssetRegisterFiltersProps) {
  const { data: locationOptions = [] } = useCampusLocations()
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localSearch, setLocalSearch] = useState(filters.search)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalSearch(filters.search)
  }, [filters.search])

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    function handleClick(e: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  function update(patch: Partial<AssetFilterState>) {
    onChange({ ...filters, ...patch })
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setLocalSearch(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      update({ search: value })
    }, 300)
  }

  function handleSearchClear() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setLocalSearch('')
    update({ search: '' })
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleSearchClear()
    }
  }

  function clearDropdownFilters() {
    onChange({
      ...filters,
      category: '',
      buildingId: '',
      areaId: '',
      roomId: '',
      status: '',
      warrantyStatus: '',
      sortField: DEFAULT_ASSET_FILTERS.sortField,
      sortDir: DEFAULT_ASSET_FILTERS.sortDir,
    })
  }

  const buildingOptions = locationOptions
    .filter((o) => o.type === 'building')
    .map((o) => ({ value: o.buildingId!, label: o.label }))

  const dropdownFilterCount = countActiveDropdownFilters(filters)

  return (
    <div className="flex items-center gap-3 pb-2">
      {/* KB-style search bar */}
      <div className="flex-1 max-w-[768px]">
        <SearchInput
          id="asset-search"
          value={localSearch}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          onClear={handleSearchClear}
          placeholder="Search assets..."
          aria-label="Search assets"
          className="rounded-full"
        />
      </div>

      {/* Filter button */}
      <div className="relative flex-shrink-0">
        <button
          ref={filterBtnRef}
          onClick={() => setPopoverOpen((o) => !o)}
          className={`inline-flex items-center gap-2 h-[52px] px-5 text-sm font-medium rounded-full border transition-all duration-200 cursor-pointer ${
            popoverOpen || dropdownFilterCount > 0
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
        {popoverOpen && (
          <div
            ref={filterPopoverRef}
            className="absolute right-0 top-full mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-5 space-y-4"
          >
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
              <Select<AssetCategoryFilter>
                value={filters.category}
                onChange={(value) => update({ category: value })}
                options={[{ value: '', label: 'All Categories' }, ...CATEGORY_OPTIONS]}
                size="sm"
              />
            </div>

            {/* Building */}
            {buildingOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Building</label>
                <Select
                  value={filters.buildingId}
                  onChange={(value) => update({ buildingId: value, areaId: '', roomId: '' })}
                  options={[{ value: '', label: 'All Buildings' }, ...buildingOptions]}
                  size="sm"
                />
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <Select<AssetStatusFilter>
                value={filters.status}
                onChange={(value) => update({ status: value })}
                options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS]}
                size="sm"
              />
            </div>

            {/* Warranty Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Warranty</label>
              <Select<WarrantyStatusFilter>
                value={filters.warrantyStatus}
                onChange={(value) => update({ warrantyStatus: value })}
                options={[{ value: '', label: 'Any Warranty' }, ...WARRANTY_OPTIONS]}
                size="sm"
              />
            </div>

            {/* Sort By + Direction row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Sort By</label>
                <Select<AssetSortField>
                  value={filters.sortField}
                  onChange={(value) => update({ sortField: value })}
                  options={SORT_OPTIONS}
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Direction</label>
                <Select<AssetSortDir>
                  value={filters.sortDir}
                  onChange={(value) => update({ sortDir: value })}
                  options={[
                    { value: 'asc', label: 'Ascending' },
                    { value: 'desc', label: 'Descending' },
                  ]}
                  size="sm"
                />
              </div>
            </div>

            {/* Clear row */}
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
  )
}
