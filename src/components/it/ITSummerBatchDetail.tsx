'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Loader2,
  Laptop,
  Check,
  Square,
  CheckSquare,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface BatchDevice {
  id: string
  assetTag: string
  deviceType: string
  make?: string | null
  model?: string | null
  status: string
  completed: boolean
}

interface BatchDetail {
  id: string
  name: string
  type: string
  status: string
  deviceCount: number
  processedCount: number
  devices: BatchDevice[]
  createdAt: string
  updatedAt: string
}

interface ITSummerBatchDetailProps {
  batchId: string
  onBack: () => void
  canManage: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────

const BATCH_TYPE_LABELS: Record<string, string> = {
  REIMAGING: 'Reimaging',
  REPAIR: 'Repair',
  STAGING: 'Staging',
  DEPLOYMENT: 'Deployment',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function BatchDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-lg" />
        <div className="h-6 w-64 bg-gray-200 rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-6 w-24 bg-gray-100 rounded-md" />
        <div className="h-6 w-20 bg-gray-100 rounded-md" />
      </div>
      <div className="h-3 w-full bg-gray-100 rounded-full" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-5 h-5 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 flex-1 bg-gray-100 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITSummerBatchDetail({
  batchId,
  onBack,
  canManage,
}: ITSummerBatchDetailProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Query ────────────────────────────────────────────────────────────
  const { data: batchRaw, isLoading } = useQuery(queryOptions.itSummerBatchDetail(batchId))
  const batch = batchRaw as BatchDetail | undefined

  // ── Mutations ────────────────────────────────────────────────────────
  const startBatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/it/summer/batches/${batchId}/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to start batch')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatchDetail.one(batchId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatches.all })
      toast('Batch started', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const completeBatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/it/summer/batches/${batchId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to complete batch')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatchDetail.one(batchId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatches.all })
      toast('Batch completed', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const markDevicesMutation = useMutation({
    mutationFn: async (deviceIds: string[]) => {
      const res = await fetch(`/api/it/summer/batches/${batchId}/devices/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ deviceIds }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to mark devices')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatchDetail.one(batchId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itSummerBatches.all })
      setSelectedIds(new Set())
      toast('Devices marked as complete', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  // ── Handlers ─────────────────────────────────────────────────────────
  const toggleDevice = (deviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) {
        next.delete(deviceId)
      } else {
        next.add(deviceId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (!batch?.devices) return
    const incomplete = batch.devices.filter((d) => !d.completed)
    if (selectedIds.size === incomplete.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(incomplete.map((d) => d.id)))
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading || !batch) {
    return (
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Summer
        </button>
        <BatchDetailSkeleton />
      </div>
    )
  }

  const devices = batch.devices ?? []
  const completedCount = devices.filter((d) => d.completed).length
  const totalCount = devices.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const incompleteDevices = devices.filter((d) => !d.completed)

  const typeLabel = BATCH_TYPE_LABELS[batch.type] ?? batch.type
  const statusStyle = STATUS_STYLES[batch.status] ?? STATUS_STYLES.PENDING

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Summer
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{batch.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                {typeLabel}
              </span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
              <span className="text-xs text-gray-400">Created {formatDate(batch.createdAt)}</span>
            </div>
          </div>

          {/* Action buttons */}
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              {batch.status === 'PENDING' && (
                <button
                  onClick={() => startBatchMutation.mutate()}
                  disabled={startBatchMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {startBatchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start Batch
                </button>
              )}
              {batch.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => completeBatchMutation.mutate()}
                  disabled={completeBatchMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completeBatchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Complete Batch
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Progress Bar ──────────────────────────────────────────── */}
      <div className="ui-glass p-5">
        <div className="flex justify-between text-sm text-gray-700 mb-2">
          <span className="font-medium">Progress</span>
          <span>
            <span className="font-bold text-gray-900">{completedCount}</span>
            <span className="text-gray-400"> / {totalCount}</span>
            <span className="text-gray-500 ml-2">({pct}%)</span>
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ─── Device Checklist ──────────────────────────────────────── */}
      <div className="ui-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Laptop className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Devices</h3>
          </div>

          {canManage && incompleteDevices.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
            >
              {selectedIds.size === incompleteDevices.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No devices in this batch</p>
            <p className="text-xs text-gray-400 mt-1">Add devices to the batch to start tracking</p>
          </div>
        ) : (
          <div className="space-y-1">
            {devices.map((device) => {
              const isSelected = selectedIds.has(device.id)
              return (
                <div
                  key={device.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    device.completed
                      ? 'bg-green-50/50 opacity-60'
                      : isSelected
                        ? 'bg-blue-50/50 border border-blue-200/50'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  {canManage && !device.completed ? (
                    <button
                      onClick={() => toggleDevice(device.id)}
                      className="shrink-0 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                      )}
                    </button>
                  ) : device.completed ? (
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-200 shrink-0" />
                  )}

                  {/* Device info */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-600">{device.assetTag}</span>
                    <span className="text-sm text-gray-700 truncate">
                      {[device.make, device.model].filter(Boolean).join(' ') || device.deviceType}
                    </span>
                  </div>

                  {/* Status indicator */}
                  {device.completed && (
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                      Done
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Bulk complete button */}
        {canManage && selectedIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200/50">
            <button
              onClick={() => markDevicesMutation.mutate(Array.from(selectedIds))}
              disabled={markDevicesMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {markDevicesMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Mark {selectedIds.size} Selected as Complete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
