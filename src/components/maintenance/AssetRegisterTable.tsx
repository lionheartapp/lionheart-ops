'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Package, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { listItem, staggerContainer } from '@/lib/animations'
import { IllustrationMaintenance } from '@/components/illustrations'
import type { AssetFilterState } from './AssetRegisterFilters'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MaintenanceAsset {
  id: string
  assetNumber: string
  name: string
  category: string | null
  make: string | null
  model: string | null
  serialNumber: string | null
  purchaseDate: string | null
  warrantyExpiry: string | null
  replacementCost: number | null
  expectedLifespanYears: number | null
  repairThresholdPct: number
  status: string
  photos: string[]
  notes: string | null
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  schoolId: string | null
  createdAt: string
  // Repeat repair intelligence sentinel fields
  repeatAlertSentAt?: string | null
  costAlertSentAt?: string | null
  eolAlertSentAt?: string | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName?: string | null } | null
  school?: { id: string; name: string } | null
}

interface AssetListResponse {
  assets: MaintenanceAsset[]
  total: number
  page: number
  limit: number
  pages: number
}

interface AssetRegisterTableProps {
  filters: AssetFilterState
  onAddAsset: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  DECOMMISSIONED: 'bg-red-100 text-red-700',
  PENDING_DISPOSAL: 'bg-amber-100 text-amber-700',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DECOMMISSIONED: 'Decommissioned',
  PENDING_DISPOSAL: 'Pending Disposal',
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial',
  GROUNDS: 'Grounds',
  IT_AV: 'IT / AV',
  OTHER: 'Other',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildQueryString(filters: AssetFilterState): string {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.buildingId) params.set('buildingId', filters.buildingId)
  if (filters.areaId) params.set('areaId', filters.areaId)
  if (filters.roomId) params.set('roomId', filters.roomId)
  if (filters.status) params.set('status', filters.status)
  if (filters.warrantyStatus) params.set('warrantyStatus', filters.warrantyStatus)
  if (filters.search) params.set('search', filters.search)
  if (filters.sortField) params.set('sortField', filters.sortField)
  if (filters.sortDir) params.set('sortDir', filters.sortDir)
  return params.toString()
}

function getWarrantyColor(warrantyExpiry: string | null): string {
  if (!warrantyExpiry) return 'text-slate-400'
  const expiry = new Date(warrantyExpiry)
  const now = new Date()
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return 'text-red-600 font-medium'
  if (daysUntil < 90) return 'text-amber-600 font-medium'
  return 'text-green-700'
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—'
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getLocationText(asset: MaintenanceAsset): string {
  const parts: string[] = []
  if (asset.building?.name) parts.push(asset.building.name)
  if (asset.room) {
    parts.push(asset.room.displayName || asset.room.roomNumber)
  } else if (asset.area?.name) {
    parts.push(asset.area.name)
  }
  return parts.join(' > ') || '—'
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function AssetTableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-4 bg-slate-200 rounded flex-1" />
          <div className="h-4 bg-slate-200 rounded w-20" />
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-4 bg-slate-200 rounded w-28" />
          <div className="h-6 bg-slate-200 rounded-full w-16" />
          <div className="h-4 bg-slate-200 rounded w-20" />
          <div className="h-4 bg-slate-200 rounded w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AssetRegisterTable({ filters, onAddAsset }: AssetRegisterTableProps) {
  const router = useRouter()

  const queryString = buildQueryString(filters)
  const { data, isLoading } = useQuery<AssetListResponse>({
    queryKey: ['maintenance-assets', queryString],
    queryFn: () => fetchApi<AssetListResponse>(`/api/maintenance/assets?${queryString}`),
    staleTime: 30_000,
  })

  const assets = data?.assets ?? []

  if (isLoading) {
    return (
      <div className="ui-glass-table">
        <AssetTableSkeleton />
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="ui-glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
        <IllustrationMaintenance className="w-48 h-40 mb-2" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">No assets found</h3>
        <p className="text-sm text-slate-500 mb-4">
          {filters.search || filters.category || filters.status
            ? 'Try adjusting your filters to find assets.'
            : 'Get started by adding your first asset to the register.'}
        </p>
        {!filters.search && !filters.category && !filters.status && (
          <button
            onClick={onAddAsset}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors cursor-pointer active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" />
            Add your first asset
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="ui-glass-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Asset #</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Category</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Make / Model</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Alerts</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Warranty Exp.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Replacement</th>
            </tr>
          </thead>
          <motion.tbody
            variants={staggerContainer(0.04, 0)}
            initial="hidden"
            animate="visible"
          >
            {assets.map((asset) => (
              <motion.tr
                key={asset.id}
                variants={listItem}
                onClick={() => router.push(`/maintenance/assets/${asset.id}`)}
                className="border-b border-slate-100 hover:bg-primary-50/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-primary-700 font-semibold">
                  {asset.assetNumber}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">
                  {asset.name}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {asset.category ? (CATEGORY_LABELS[asset.category] || asset.category) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {asset.make && asset.model
                    ? `${asset.make} ${asset.model}`
                    : asset.make || asset.model || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">
                  {getLocationText(asset)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {STATUS_LABELS[asset.status] || asset.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {asset.repeatAlertSentAt && (
                      <span title="Repeat Repair" className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                        <AlertTriangle className="w-3 h-3 text-orange-600" />
                      </span>
                    )}
                    {asset.costAlertSentAt && (
                      <span title="Cost Threshold" className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                        <TrendingUp className="w-3 h-3 text-red-600" />
                      </span>
                    )}
                    {asset.eolAlertSentAt && (
                      <span title="End of Life" className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                        <Clock className="w-3 h-3 text-slate-600" />
                      </span>
                    )}
                    {!asset.repeatAlertSentAt && !asset.costAlertSentAt && !asset.eolAlertSentAt && (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-xs ${getWarrantyColor(asset.warrantyExpiry)}`}>
                  {formatDate(asset.warrantyExpiry)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {formatCurrency(asset.replacementCost)}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
      {data && data.total > data.limit && (
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 text-right">
          Showing {assets.length} of {data.total} assets
        </div>
      )}
    </div>
  )
}
