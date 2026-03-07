'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, SlidersHorizontal } from 'lucide-react'
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
  const localSearchRef = useRef(filters.search)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localSearchRef.current = filters.search
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
    localSearchRef.current = value
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      update({ search: value })
    }, 300)
  }

  function handleSearchClear() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    localSearchRef.current = ''
    const searchInput = document.getElementById('asset-search') as HTMLInputElement | null
    if (searchInput) searchInput.value = ''
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

  const selectClass = 'w-full h-10 px-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer'

  return (
    <div className="flex items-center gap-3 pb-2">
      {/* KB-style search bar */}
      <div className="group relative flex-1 max-w-[768px]">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
          <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
        </div>
        <input
          id="asset-search"
          type="search"
          defaultValue={filters.search}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search assets..."
          className="w-full h-[52px] pl-14 pr-12 text-base text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-full focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition-all duration-200"
          aria-label="Search assets"
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
          onClick={() => setPopoverOpen((o) => !o)}
          className={`inline-flex items-center gap-2 h-[52px] px-5 text-sm font-medium rounded-full border transition-all duration-200 cursor-pointer ${
            popoverOpen || dropdownFilterCount > 0
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
        {popoverOpen && (
          <div
            ref={filterPopoverRef}
            className="absolute right-0 top-full mt-2 w-[320px] bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-5 space-y-4"
          >
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
              <select
                value={filters.category}
                onChange={(e) => update({ category: e.target.value as AssetCategoryFilter })}
                className={selectClass}
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Building */}
            {buildingOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Building</label>
                <select
                  value={filters.buildingId}
                  onChange={(e) => update({ buildingId: e.target.value, areaId: '', roomId: '' })}
                  className={selectClass}
                >
                  <option value="">All Buildings</option>
                  {buildingOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select
                value={filters.status}
                onChange={(e) => update({ status: e.target.value as AssetStatusFilter })}
                className={selectClass}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Warranty Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Warranty</label>
              <select
                value={filters.warrantyStatus}
                onChange={(e) => update({ warrantyStatus: e.target.value as WarrantyStatusFilter })}
                className={selectClass}
              >
                <option value="">Any Warranty</option>
                {WARRANTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Sort By + Direction row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Sort By</label>
                <select
                  value={filters.sortField}
                  onChange={(e) => update({ sortField: e.target.value as AssetSortField })}
                  className={selectClass}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Direction</label>
                <select
                  value={filters.sortDir}
                  onChange={(e) => update({ sortDir: e.target.value as AssetSortDir })}
                  className={selectClass}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>

            {/* Clear row */}
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
  )
}
