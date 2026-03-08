'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import {
  ArrowLeft, Play, CheckCircle2, XCircle, Ban, Search,
  Users, Truck, Package, Loader2, RefreshCw, FileWarning,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BatchDetail {
  id: string
  name: string
  batchType: 'DEPLOYMENT' | 'COLLECTION'
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  schoolYear?: string | null
  grade?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  school?: { id: string; name: string } | null
  items: BatchItem[]
}

interface BatchItem {
  id: string
  status: 'PENDING' | 'PROCESSED' | 'SKIPPED'
  condition?: string | null
  damageNotes?: string | null
  damageFeeCents?: number | null
  processedAt?: string | null
  device?: {
    id: string
    assetTag: string
    deviceType: string
    make?: string | null
    model?: string | null
  } | null
  student?: {
    id: string
    firstName: string
    lastName: string
    studentId?: string | null
    grade?: string | null
  } | null
}

interface BatchProgress {
  total: number
  processed: number
  remaining: number
}

interface StudentSearchResult {
  id: string
  firstName: string
  lastName: string
  studentId?: string | null
  grade?: string | null
  school?: { id: string; name: string } | null
}

interface Props {
  batchId: string
  onBack: () => void
  canManage: boolean
  canProcess: boolean
  onOpenDamageReport?: (batchId: string) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CONDITION_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
  { value: 'BROKEN', label: 'Broken' },
]

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  FAIR: 'bg-yellow-100 text-yellow-700',
  POOR: 'bg-orange-100 text-orange-700',
  BROKEN: 'bg-red-100 text-red-700',
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function BatchDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-gray-200 rounded-lg" />
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
      {/* Progress bar */}
      <div className="ui-glass p-5 rounded-2xl space-y-3">
        <div className="h-4 w-32 bg-gray-100 rounded" />
        <div className="h-2 w-full bg-gray-100 rounded-full" />
        <div className="flex gap-4">
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
        </div>
      </div>
      {/* Actions */}
      <div className="flex gap-3">
        <div className="h-10 w-28 bg-gray-200 rounded-full" />
        <div className="h-10 w-28 bg-gray-200 rounded-full" />
      </div>
      {/* Table */}
      <div className="ui-glass-table">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-4 w-16 bg-gray-100 rounded" />
              <div className="h-4 flex-1 bg-gray-100 rounded" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-8 w-20 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Badge Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

function ItemStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    PROCESSED: 'bg-green-100 text-green-700',
    SKIPPED: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONDITION_COLORS[condition] || 'bg-gray-100 text-gray-600'}`}>
      {condition}
    </span>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ITDeploymentBatchDetail({
  batchId,
  onBack,
  canManage,
  canProcess,
  onOpenDamageReport,
}: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [itemConditions, setItemConditions] = useState<Record<string, string>>({})
  const [itemDamageNotes, setItemDamageNotes] = useState<Record<string, string>>({})
  const [itemFees, setItemFees] = useState<Record<string, string>>({})

  // ─── Queries ──────────────────────────────────────────────────────────

  const { data: batchData, isLoading } = useQuery(queryOptions.itDeploymentBatchDetail(batchId))
  const batch = batchData as BatchDetail | undefined

  const { data: progressData } = useQuery({
    ...queryOptions.itDeploymentBatchProgress(batchId),
    enabled: !!batch && (batch.status === 'IN_PROGRESS' || batch.status === 'COMPLETED'),
    refetchInterval: batch?.status === 'IN_PROGRESS' ? 5000 : false,
  })
  const progress = progressData as BatchProgress | undefined

  // Default fees for collection batches
  const { data: defaultFees } = useQuery({
    ...queryOptions.itDefaultFees(),
    enabled: batch?.batchType === 'COLLECTION',
  })

  // Student search for assignment
  const { data: studentResults = [] } = useQuery<StudentSearchResult[]>({
    queryKey: ['student-search-deploy', assignSearch],
    queryFn: async () => {
      if (!assignSearch.trim()) return []
      const res = await fetch(`/api/it/students?search=${encodeURIComponent(assignSearch)}&limit=10`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? (json.data?.students ?? []) : []
    },
    enabled: !!assigningItemId && assignSearch.trim().length >= 2,
    staleTime: 10_000,
  })

  // ─── Mutations ────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/it/deployment/batches/${batchId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to update batch')
      }
      return res.json()
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchDetail.one(batchId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatches.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchProgress.one(batchId) })
      const statusLabels: Record<string, string> = {
        IN_PROGRESS: 'started',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
      }
      toast(`Batch ${statusLabels[newStatus] || 'updated'}`, 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const processItemMutation = useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/it/deployment/batches/${batchId}/items/${itemId}/process`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to process item')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchDetail.one(batchId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchProgress.one(batchId) })
      toast('Item processed', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const assignStudentMutation = useMutation({
    mutationFn: async ({ itemId, studentId }: { itemId: string; studentId: string }) => {
      const res = await fetch(`/api/it/deployment/batches/${batchId}/items/${itemId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ studentId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to assign student')
      }
      return res.json()
    },
    onSuccess: () => {
      setAssigningItemId(null)
      setAssignSearch('')
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchDetail.one(batchId) })
      toast('Student assigned', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/it/deployment/batches/${batchId}/auto-populate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Auto-populate failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchDetail.one(batchId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatchProgress.one(batchId) })
      toast('Batch auto-populated', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleProcessItem = useCallback((item: BatchItem) => {
    const body: Record<string, unknown> = {}
    if (batch?.batchType === 'COLLECTION') {
      const condition = itemConditions[item.id]
      if (condition) body.condition = condition
      const notes = itemDamageNotes[item.id]
      if (notes?.trim()) body.damageNotes = notes.trim()
      const fee = itemFees[item.id]
      if (fee) body.damageFeeCents = Math.round(parseFloat(fee) * 100)
    }
    processItemMutation.mutate({ itemId: item.id, body })
  }, [batch?.batchType, itemConditions, itemDamageNotes, itemFees, processItemMutation])

  const handleConditionChange = useCallback((itemId: string, condition: string) => {
    setItemConditions((prev) => ({ ...prev, [itemId]: condition }))
    // Auto-fill fee from defaults
    if (defaultFees && condition) {
      const fees = defaultFees as Record<string, number>
      const fee = fees[condition]
      if (fee !== undefined) {
        setItemFees((prev) => ({ ...prev, [itemId]: (fee / 100).toFixed(2) }))
      }
    }
  }, [defaultFees])

  // ─── Render ───────────────────────────────────────────────────────────

  if (isLoading || !batch) return <BatchDetailSkeleton />

  const isDeployment = batch.batchType === 'DEPLOYMENT'
  const isDraft = batch.status === 'DRAFT'
  const isInProgress = batch.status === 'IN_PROGRESS'
  const isActive = isDraft || isInProgress

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return batch.items
    const q = searchQuery.toLowerCase()
    return batch.items.filter((item) => {
      const assetTag = item.device?.assetTag?.toLowerCase() || ''
      const make = item.device?.make?.toLowerCase() || ''
      const model = item.device?.model?.toLowerCase() || ''
      const studentName = item.student
        ? `${item.student.firstName} ${item.student.lastName}`.toLowerCase()
        : ''
      return assetTag.includes(q) || make.includes(q) || model.includes(q) || studentName.includes(q)
    })
  }, [batch.items, searchQuery])

  const totalItems = progress?.total ?? batch.items.length
  const processedItems = progress?.processed ?? batch.items.filter((i) => i.status === 'PROCESSED').length
  const pct = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{batch.name}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <StatusBadge status={batch.status} />
            {isDeployment ? (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                <Truck className="w-3 h-3" /> Deployment
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <Package className="w-3 h-3" /> Collection
              </span>
            )}
            {batch.school && (
              <span className="text-xs text-gray-400">{batch.school.name}</span>
            )}
            {batch.schoolYear && (
              <span className="text-xs text-gray-400">{batch.schoolYear}</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress card */}
      {totalItems > 0 && (
        <div className="ui-glass p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Progress</p>
            <p className="text-sm font-semibold text-gray-900">{pct}%</p>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isDeployment ? 'bg-blue-500' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {processedItems} processed
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-gray-400" />
              {(progress?.remaining ?? totalItems - processedItems)} remaining
            </span>
            <span>{totalItems} total</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {canManage && isActive && (
        <div className="flex flex-wrap gap-3">
          {isDraft && (
            <>
              <button
                onClick={() => statusMutation.mutate('IN_PROGRESS')}
                disabled={statusMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {statusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Batch
              </button>
              <button
                onClick={() => autoPopulateMutation.mutate()}
                disabled={autoPopulateMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {autoPopulateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                Auto-populate
              </button>
            </>
          )}
          {isInProgress && (
            <button
              onClick={() => statusMutation.mutate('COMPLETED')}
              disabled={statusMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {statusMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Complete Batch
            </button>
          )}
          <button
            onClick={() => statusMutation.mutate('CANCELLED')}
            disabled={statusMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Ban className="w-4 h-4" />
            Cancel
          </button>

          {!isDeployment && onOpenDamageReport && (
            <button
              onClick={() => onOpenDamageReport(batchId)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all ml-auto"
            >
              <FileWarning className="w-4 h-4" />
              Damage Report
            </button>
          )}
        </div>
      )}

      {/* View-only damage report button */}
      {!isActive && !isDeployment && onOpenDamageReport && (
        <div className="flex">
          <button
            onClick={() => onOpenDamageReport(batchId)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all"
          >
            <FileWarning className="w-4 h-4" />
            View Damage Report
          </button>
        </div>
      )}

      {/* Search */}
      {batch.items.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by asset tag, student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
          />
        </div>
      )}

      {/* Items table */}
      {batch.items.length === 0 ? (
        <div className="ui-glass p-8 text-center">
          <p className="text-sm text-gray-500">No devices in this batch</p>
          <p className="text-xs text-gray-400 mt-1">
            {isDraft ? 'Use auto-populate to add devices, or add them manually' : 'No items were added to this batch'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {filteredItems.length} of {batch.items.length} item{batch.items.length !== 1 ? 's' : ''}
          </p>

          {/* Desktop table */}
          <div className="hidden md:block ui-glass-table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                    <th className="px-4 py-3 font-medium">Asset Tag</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Make / Model</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    {!isDeployment && (
                      <>
                        <th className="px-4 py-3 font-medium">Condition</th>
                        <th className="px-4 py-3 font-medium">Fee</th>
                      </>
                    )}
                    <th className="px-4 py-3 font-medium">Status</th>
                    {canProcess && isActive && (
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100/50 hover:bg-gray-50/50 transition-colors"
                    >
                      {/* Asset Tag */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-700">
                          {item.device?.assetTag ?? '—'}
                        </span>
                      </td>
                      {/* Device Type */}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {item.device?.deviceType ?? '—'}
                      </td>
                      {/* Make / Model */}
                      <td className="px-4 py-3 text-gray-700">
                        {[item.device?.make, item.device?.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      {/* Student */}
                      <td className="px-4 py-3">
                        {assigningItemId === item.id ? (
                          <div className="space-y-1.5 min-w-[200px]">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search students..."
                                value={assignSearch}
                                onChange={(e) => setAssignSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                                autoFocus
                              />
                            </div>
                            {studentResults.length > 0 && (
                              <div className="max-h-28 overflow-y-auto rounded-md border border-gray-200 bg-white">
                                {studentResults.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => assignStudentMutation.mutate({ itemId: item.id, studentId: s.id })}
                                    disabled={assignStudentMutation.isPending}
                                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                                  >
                                    <span className="font-medium text-gray-900">
                                      {s.firstName} {s.lastName}
                                    </span>
                                    {s.studentId && (
                                      <span className="ml-1.5 text-gray-400 font-mono">#{s.studentId}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => { setAssigningItemId(null); setAssignSearch('') }}
                              className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : item.student ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-700">
                              {item.student.firstName} {item.student.lastName}
                            </span>
                            {isDeployment && isActive && canProcess && (
                              <button
                                onClick={() => setAssigningItemId(item.id)}
                                className="text-[10px] text-blue-500 hover:text-blue-700 cursor-pointer"
                              >
                                change
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">Unassigned</span>
                            {isDeployment && isActive && canProcess && (
                              <button
                                onClick={() => setAssigningItemId(item.id)}
                                className="text-[10px] text-blue-500 hover:text-blue-700 cursor-pointer"
                              >
                                assign
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Collection-only columns */}
                      {!isDeployment && (
                        <>
                          {/* Condition */}
                          <td className="px-4 py-3">
                            {item.status === 'PROCESSED' && item.condition ? (
                              <ConditionBadge condition={item.condition} />
                            ) : isActive && canProcess && item.status === 'PENDING' ? (
                              <select
                                value={itemConditions[item.id] || ''}
                                onChange={(e) => handleConditionChange(item.id, e.target.value)}
                                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/40 cursor-pointer"
                              >
                                {CONDITION_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          {/* Fee */}
                          <td className="px-4 py-3">
                            {item.status === 'PROCESSED' && item.damageFeeCents != null ? (
                              <span className="text-xs text-gray-700">
                                ${(item.damageFeeCents / 100).toFixed(2)}
                              </span>
                            ) : isActive && canProcess && item.status === 'PENDING' ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={itemFees[item.id] || ''}
                                onChange={(e) => setItemFees((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="0.00"
                                className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                              />
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Status */}
                      <td className="px-4 py-3">
                        <ItemStatusBadge status={item.status} />
                      </td>

                      {/* Action */}
                      {canProcess && isActive && (
                        <td className="px-4 py-3 text-right">
                          {item.status === 'PENDING' ? (
                            <button
                              onClick={() => handleProcessItem(item)}
                              disabled={processItemMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              {processItemMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              Process
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              {item.processedAt
                                ? new Date(item.processedAt).toLocaleDateString()
                                : '—'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {filteredItems.map((item) => (
              <div key={item.id} className="ui-glass p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-700">
                    {item.device?.assetTag ?? '—'}
                  </span>
                  <ItemStatusBadge status={item.status} />
                </div>
                <p className="text-sm text-gray-900">
                  {[item.device?.make, item.device?.model].filter(Boolean).join(' ') || item.device?.deviceType || '—'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {item.student ? (
                    <span>{item.student.firstName} {item.student.lastName}</span>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </div>
                {!isDeployment && item.condition && (
                  <div className="flex items-center gap-2">
                    <ConditionBadge condition={item.condition} />
                    {item.damageFeeCents != null && item.damageFeeCents > 0 && (
                      <span className="text-xs text-gray-600">${(item.damageFeeCents / 100).toFixed(2)}</span>
                    )}
                  </div>
                )}
                {/* Collection inline controls for mobile */}
                {!isDeployment && isActive && canProcess && item.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 pt-1">
                    <select
                      value={itemConditions[item.id] || ''}
                      onChange={(e) => handleConditionChange(item.id, e.target.value)}
                      className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 cursor-pointer"
                    >
                      {CONDITION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemFees[item.id] || ''}
                        onChange={(e) => setItemFees((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Fee"
                        className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      />
                      <button
                        onClick={() => handleProcessItem(item)}
                        disabled={processItemMutation.isPending}
                        className="px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                      >
                        Process
                      </button>
                    </div>
                  </div>
                )}
                {isDeployment && isActive && canProcess && item.status === 'PENDING' && (
                  <button
                    onClick={() => handleProcessItem(item)}
                    disabled={processItemMutation.isPending}
                    className="w-full mt-1 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                  >
                    Process
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      {batch.notes && (
        <div className="ui-glass p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{batch.notes}</p>
        </div>
      )}
    </div>
  )
}
