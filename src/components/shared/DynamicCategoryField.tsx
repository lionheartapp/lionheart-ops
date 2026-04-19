'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Package, AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { queryOptions } from '@/lib/queries'
import type { FieldDefinition } from '@/lib/services/categoryFieldLibrary'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DynamicCategoryFieldProps {
  field: FieldDefinition & { required: boolean }
  value: unknown
  onChange: (value: unknown) => void
  formValues: Record<string, unknown>
  module: 'MAINTENANCE' | 'IT'
}

interface AssetResult {
  id: string
  assetNumber: string
  name: string
  building?: { name: string } | null
  room?: { roomNumber: string; displayName?: string | null } | null
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DynamicCategoryField({
  field,
  value,
  onChange,
  formValues,
  module,
}: DynamicCategoryFieldProps) {
  // Check conditional visibility
  if (field.showIf) {
    const conditionValue = formValues[field.showIf.field]
    if (conditionValue !== field.showIf.value) return null
  }

  const label = (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  switch (field.renderType) {
    case 'checkbox':
      return <CheckboxField field={field} value={value} onChange={onChange} />
    case 'textarea':
      return (
        <div>
          {label}
          <textarea
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow resize-none"
          />
        </div>
      )
    case 'number':
      return (
        <div>
          {label}
          <input
            type="number"
            min={1}
            value={(value as number) ?? ''}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="Enter a number"
            className="w-full max-w-[140px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow"
          />
        </div>
      )
    case 'dropdown':
      return (
        <div>
          {label}
          <select
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow cursor-pointer"
          >
            <option value="">Select...</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )
    case 'user-picker':
      return <UserPickerField field={field} value={value} onChange={onChange} label={label} />
    case 'asset-picker':
      return <AssetPickerField field={field} value={value} onChange={onChange} module={module} label={label} />
    default:
      return null
  }
}

// ─── Checkbox Field ──────────────────────────────────────────────────────────

function CheckboxField({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}) {
  const checked = value === true
  const isSafety = field.type === 'SAFETY_HAZARD'

  return (
    <label
      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
        checked
          ? isSafety
            ? 'border-red-300 bg-red-50'
            : 'border-blue-300 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      <div>
        <div className="flex items-center gap-1.5">
          {isSafety && <AlertTriangle className="w-4 h-4 text-red-500" />}
          <span className={`text-sm font-medium ${checked && isSafety ? 'text-red-800' : 'text-slate-900'}`}>
            {field.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
      </div>
    </label>
  )
}

// ─── User Picker Field ───────────────────────────────────────────────────────

function UserPickerField({
  field,
  value,
  onChange,
  label,
}: {
  field: FieldDefinition & { required: boolean }
  value: unknown
  onChange: (value: unknown) => void
  label: React.ReactNode
}) {
  const { data: membersData } = useQuery(queryOptions.members())
  const members = (membersData ?? []) as Array<{
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }>

  return (
    <div>
      {label}
      <select
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow cursor-pointer"
      >
        <option value="">Select a person...</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.firstName} {m.lastName} ({m.email})
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Asset Picker Field ──────────────────────────────────────────────────────

function AssetPickerField({
  field,
  value,
  onChange,
  module,
  label,
}: {
  field: FieldDefinition & { required: boolean }
  value: unknown
  onChange: (value: unknown) => void
  module: 'MAINTENANCE' | 'IT'
  label: React.ReactNode
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<AssetResult[]>([])
  const [searching, setSearching] = useState(false)
  const selectedAsset = value as AssetResult | null

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const endpoint = module === 'MAINTENANCE'
        ? `/api/maintenance/assets?search=${encodeURIComponent(query)}&limit=8`
        : `/api/it/devices?search=${encodeURIComponent(query)}&limit=8`
      const data = await fetchApi<AssetResult[]>(endpoint)
      setResults(data ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [module])

  // Debounced search
  useEffect(() => {
    if (!search) {
      setResults([])
      return
    }
    const timer = setTimeout(() => doSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search, doSearch])

  if (selectedAsset) {
    return (
      <div>
        {label}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50">
          <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">
              {selectedAsset.name}
            </div>
            <div className="text-xs text-slate-500">
              {selectedAsset.assetNumber}
              {selectedAsset.building && ` · ${selectedAsset.building.name}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {label}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={module === 'MAINTENANCE' ? 'Search assets (name or AST-XXXX)...' : 'Search devices...'}
          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                onChange(asset)
                setSearch('')
                setResults([])
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-slate-50 transition-colors cursor-pointer first:rounded-t-xl last:rounded-b-xl"
            >
              <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-slate-900 truncate">{asset.name}</div>
                <div className="text-xs text-slate-400">{asset.assetNumber}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {searching && (
        <p className="mt-1 text-xs text-slate-400">Searching...</p>
      )}
    </div>
  )
}
