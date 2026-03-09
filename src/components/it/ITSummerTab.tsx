'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import ITSummerBatchDetail from './ITSummerBatchDetail'
import ITVendorRepairDialog from './ITVendorRepairDialog'
import {
  Sun,
  Plus,
  ChevronRight,
  Wrench,
  ArrowLeft,
  Package,
  Loader2,
  Calendar,
  Laptop,
  AlertCircle,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { IllustrationDeployment } from '@/components/illustrations'

// ─── Types ──────────────────────────────────────────────────────────────

interface SummerBatch {
  id: string
  name: string
  type: string
  status: string
  deviceCount: number
  processedCount: number
  createdAt: string
  updatedAt: string
}

interface RepairItem {
  id: string
  deviceId: string
  device?: {
    assetTag: string
    make?: string | null
    model?: string | null
    deviceType: string
  }
  description: string
  status: string
  vendorName?: string | null
  sentDate?: string | null
  receivedDate?: string | null
  estimatedCost?: number | null
  actualCost?: number | null
  createdAt: string
}

interface StagingCounts {
  total: number
  byModel: Record<string, number>
}

// ─── Constants ──────────────────────────────────────────────────────────

const BATCH_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
}

const REPAIR_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  { value: 'SENT_TO_VENDOR', label: 'Sent to Vendor', icon: Truck, color: 'bg-blue-100 text-blue-700' },
  { value: 'IN_REPAIR', label: 'In Repair', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  { value: 'REPAIRED', label: 'Repaired', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  { value: 'RETIRED', label: 'Retired', icon: Trash2, color: 'bg-red-100 text-red-700' },
]

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function BatchStatusBadge({ status }: { status: string }) {
  const s = BATCH_STATUS_STYLES[status] ?? BATCH_STATUS_STYLES.PENDING
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function RepairStatusBadge({ status }: { status: string }) {
  const opt = REPAIR_STATUS_OPTIONS.find((o) => o.value === status) ?? REPAIR_STATUS_OPTIONS[0]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${opt.color}`}>
      <opt.icon className="w-3 h-3" />
      {opt.label}
    </span>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function SummerTabSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Summer mode card */}
      <div className="ui-glass p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-3 w-64 bg-gray-100 rounded" />
          </div>
          <div className="h-8 w-16 bg-gray-200 rounded-full" />
        </div>
      </div>
      {/* Sections */}
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((j) => (
              <div key={j} className="ui-glass p-5 rounded-2xl">
                <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
                <div className="h-2 w-full bg-gray-100 rounded-full mb-2" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

interface ITSummerTabProps {
  canManage: boolean
}

export default function ITSummerTab({ canManage }: ITSummerTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Local state ──────────────────────────────────────────────────────
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [vendorRepairId, setVendorRepairId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: summerModeRaw, isLoading: modeLoading } = useQuery(queryOptions.itSummerMode())
  const summerMode = summerModeRaw as { active: boolean; startDate: string | null; endDate: string | null } | undefined

  const { data: batchesRaw, isLoading: batchesLoading } = useQuery(
    queryOptions.itSummerBatches({ type: 'REIMAGING' })
  )
  const batches = (Array.isArray(batchesRaw) ? batchesRaw : []) as SummerBatch[]

  const { data: repairsRaw, isLoading: repairsLoading } = useQuery(queryOptions.itRepairQueue())
  const repairs = (Array.isArray(repairsRaw) ? repairsRaw : []) as RepairItem[]

  const { data: stagingRaw, isLoading: stagingLoading } = useQuery(queryOptions.itStagingCounts())
  const staging = stagingRaw as StagingCounts | undefined

  // ── Mutations ────────────────────────────────────────────────────────
  const toggleModeMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const body: Record<string, unknown> = { active: activate }
      if (activate && startDate) body.startDate = startDate
      if (activate && endDate) body.endDate = endDate
      const res = await fetch('/api/it/summer/mode', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to toggle summer mode')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerMode.all })
      toast('Summer mode updated', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const createBatchMutation = useMutation({
    mutationFn: async () => {
      const name = `Reimaging Batch — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      const res = await fetch('/api/it/summer/batches', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, type: 'REIMAGING' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to create batch')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatches.all })
      toast('Reimaging batch created', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const updateRepairStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/it/summer/repair-queue/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to update repair status')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itRepairQueue.all })
      setStatusDropdownId(null)
      toast('Repair status updated', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  // ── Group repairs by status ─────────────────────────────────────────
  const repairsByStatus = useMemo(() => {
    const groups: Record<string, RepairItem[]> = {
      PENDING: [],
      SENT_TO_VENDOR: [],
      IN_REPAIR: [],
      REPAIRED: [],
      RETIRED: [],
    }
    for (const r of repairs) {
      if (groups[r.status]) groups[r.status].push(r)
      else groups.PENDING.push(r)
    }
    return groups
  }, [repairs])

  // ── If viewing a batch detail ────────────────────────────────────────
  if (selectedBatchId) {
    return (
      <ITSummerBatchDetail
        batchId={selectedBatchId}
        onBack={() => setSelectedBatchId(null)}
        canManage={canManage}
      />
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (modeLoading && batchesLoading) return <SummerTabSkeleton />

  const isActive = summerMode?.active ?? false

  return (
    <div className="space-y-8">
      {/* ─── Summer Mode Toggle Card ─────────────────────────────────── */}
      <div className={`ui-glass p-6 border-2 transition-colors duration-200 ${
        isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isActive
              ? 'bg-gradient-to-br from-amber-400 to-orange-500'
              : 'bg-gray-100'
          }`}>
            <Sun className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">Summer Mode</h3>
              {isActive ? (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {isActive
                ? `Active from ${formatDate(summerMode?.startDate)} to ${formatDate(summerMode?.endDate)}`
                : 'Enable summer mode to start reimaging, repair, and staging workflows'}
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => toggleModeMutation.mutate(!isActive)}
              disabled={toggleModeMutation.isPending}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                isActive ? 'bg-green-500' : 'bg-gray-300'
              }`}
              aria-label={isActive ? 'Disable summer mode' : 'Enable summer mode'}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>

        {/* Date pickers when inactive and toggling on */}
        {!isActive && canManage && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Reimaging Batches ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Reimaging Batches</h3>
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
              {batches.length}
            </span>
          </div>
          {canManage && (
            <button
              onClick={() => createBatchMutation.mutate()}
              disabled={createBatchMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createBatchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Batch
            </button>
          )}
        </div>

        {batchesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="ui-glass p-5 rounded-2xl">
                <div className="h-4 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-2 w-full bg-gray-100 rounded-full mb-3" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 bg-gray-100 rounded-md" />
                  <div className="h-5 w-16 bg-gray-100 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationDeployment className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">No reimaging batches</p>
            <p className="text-xs text-gray-400 mt-1">
              Create a batch to start tracking summer reimaging progress
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {batches.map((batch) => {
              const pct = batch.deviceCount > 0
                ? Math.round((batch.processedCount / batch.deviceCount) * 100)
                : 0
              return (
                <button
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  className="text-left ui-glass-hover p-5 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{batch.name}</h4>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{batch.processedCount} / {batch.deviceCount} devices</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <BatchStatusBadge status={batch.status} />
                    <span className="text-xs text-gray-400">{formatDate(batch.createdAt)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Divider ─────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200/60" />

      {/* ─── Repair Queue ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-gray-700" />
          <h3 className="text-sm font-semibold text-gray-900">Repair Queue</h3>
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
            {repairs.length}
          </span>
        </div>

        {repairsLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ui-glass p-4 rounded-2xl">
                <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-64 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : repairs.length === 0 ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationDeployment className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">No repairs in queue</p>
            <p className="text-xs text-gray-400 mt-1">
              All devices are in working order
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {REPAIR_STATUS_OPTIONS.map((statusOpt) => {
              const items = repairsByStatus[statusOpt.value] ?? []
              if (items.length === 0) return null
              return (
                <div key={statusOpt.value}>
                  <div className="flex items-center gap-2 mb-3">
                    <statusOpt.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {statusOpt.label}
                    </span>
                    <span className="text-xs text-gray-400">({items.length})</span>
                  </div>

                  <div className="space-y-2">
                    {items.map((repair) => (
                      <div key={repair.id} className="ui-glass p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-gray-500">
                              {repair.device?.assetTag ?? '—'}
                            </span>
                            <RepairStatusBadge status={repair.status} />
                          </div>
                          <p className="text-sm text-gray-700 truncate">{repair.description}</p>
                          {repair.vendorName && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Vendor: {repair.vendorName}
                              {repair.estimatedCost != null && ` | Est: $${(repair.estimatedCost / 100).toFixed(2)}`}
                            </p>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status change dropdown */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setStatusDropdownId(statusDropdownId === repair.id ? null : repair.id)
                                }
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                Change Status
                              </button>
                              {statusDropdownId === repair.id && (
                                <div className="absolute right-0 top-full mt-1 z-20 ui-glass-dropdown py-1 min-w-[160px]">
                                  {REPAIR_STATUS_OPTIONS.filter((o) => o.value !== repair.status).map(
                                    (opt) => (
                                      <button
                                        key={opt.value}
                                        onClick={() =>
                                          updateRepairStatusMutation.mutate({
                                            id: repair.id,
                                            status: opt.value,
                                          })
                                        }
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                                      >
                                        <opt.icon className="w-3.5 h-3.5 text-gray-400" />
                                        {opt.label}
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Add vendor log */}
                            <button
                              onClick={() => setVendorRepairId(repair.id)}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              Vendor Log
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Divider ─────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200/60" />

      {/* ─── Staging Section ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-700" />
          <h3 className="text-sm font-semibold text-gray-900">Deployment Staging</h3>
        </div>

        {stagingLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ui-glass p-4 rounded-2xl">
                <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-8 w-12 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Total count */}
            <div className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-2xl shadow-sm p-4 flex items-center gap-3 mb-4">
              <Laptop className="w-5 h-5 text-primary-600 shrink-0" />
              <div>
                <span className="text-sm font-medium text-primary-900">
                  Total devices staged for deployment:{' '}
                </span>
                <span className="text-sm font-bold text-primary-700">
                  {staging?.total ?? 0}
                </span>
              </div>
            </div>

            {/* Per-model breakdown */}
            {staging?.byModel && Object.keys(staging.byModel).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(staging.byModel)
                  .sort(([, a], [, b]) => b - a)
                  .map(([model, count]) => (
                    <div key={model} className="ui-glass p-4 text-center">
                      <div className="mx-auto w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                        <Laptop className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-xl font-bold text-gray-900">{count}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate" title={model}>
                        {model}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="ui-glass p-6 text-center">
                <IllustrationDeployment className="w-40 h-32 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No devices currently staged</p>
                <p className="text-xs text-gray-400 mt-1">
                  Devices will appear here once they are flagged for deployment staging
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Vendor Repair Dialog ────────────────────────────────────── */}
      <ITVendorRepairDialog
        repairId={vendorRepairId}
        isOpen={!!vendorRepairId}
        onClose={() => setVendorRepairId(null)}
      />
    </div>
  )
}
