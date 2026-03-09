'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { Rocket, Plus, Truck, Package, Calendar, GraduationCap } from 'lucide-react'
import { IllustrationDeployment } from '@/components/illustrations'
import ITSearchFilterBar from './ITSearchFilterBar'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeploymentBatch {
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
  _count?: { items: number }
  processedCount?: number
  totalCount?: number
}

interface School {
  id: string
  name: string
}

interface Props {
  canManage: boolean
  onViewBatch?: (batchId: string) => void
  onCreateBatch?: () => void
}

// ─── Filter Options ─────────────────────────────────────────────────────────

const BATCH_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'DEPLOYMENT', label: 'Deployment' },
  { value: 'COLLECTION', label: 'Collection' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

// ─── Badge Components ───────────────────────────────────────────────────────

function BatchStatusBadge({ status }: { status: string }) {
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

function BatchTypeBadge({ type }: { type: string }) {
  if (type === 'DEPLOYMENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
        <Truck className="w-3 h-3" />
        Deployment
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <Package className="w-3 h-3" />
      Collection
    </span>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DeploymentTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 animate-pulse">
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 bg-gray-100 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ processed, total, type }: { processed: number; total: number; type: string }) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0
  const barColor = type === 'DEPLOYMENT' ? 'bg-blue-500' : 'bg-amber-500'
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400">
        {processed} / {total} processed ({pct}%)
      </p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ITDeploymentTab({ canManage, onViewBatch, onCreateBatch }: Props) {
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [search, setSearch] = useState('')

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (typeFilter) f.batchType = typeFilter
    if (statusFilter) f.status = statusFilter
    if (schoolFilter) f.schoolId = schoolFilter
    if (search) f.search = search
    return f
  }, [typeFilter, statusFilter, schoolFilter, search])

  const { data, isLoading } = useQuery(queryOptions.itDeploymentBatches(filters))

  // Fetch schools for filter
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-deployment'],
    queryFn: async () => {
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? json.data : []
    },
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <DeploymentTabSkeleton />

  const batches = (Array.isArray(data) ? data : []) as DeploymentBatch[]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <ITSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search batches..."
        filters={[
          { label: 'Batch Type', value: typeFilter, onChange: setTypeFilter, options: BATCH_TYPE_OPTIONS },
          { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
          ...(schools.length > 1 ? [{
            label: 'Campus',
            value: schoolFilter,
            onChange: (v: string) => setSchoolFilter(v),
            options: [{ value: '', label: 'All Campuses' }, ...schools.map((s) => ({ value: s.id, label: s.name }))],
          }] : []),
        ]}
        trailing={canManage ? (
          <button
            onClick={onCreateBatch}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Batch
          </button>
        ) : undefined}
      />

      {/* Results */}
      {batches.length === 0 ? (
        <div className="ui-glass p-12 text-center">
          <IllustrationDeployment className="w-48 h-40 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600 mb-1">No deployment batches yet</p>
          <p className="text-xs text-gray-400">
            Create a batch to start deploying or collecting devices
          </p>
          {canManage && (
            <button
              onClick={onCreateBatch}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Batch
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {batches.map((batch) => {
              const processed = batch.processedCount ?? 0
              const total = batch.totalCount ?? batch._count?.items ?? 0
              return (
                <button
                  key={batch.id}
                  onClick={() => onViewBatch?.(batch.id)}
                  className="w-full text-left ui-glass-hover p-5 space-y-3"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {batch.name}
                    </h3>
                    <BatchStatusBadge status={batch.status} />
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <BatchTypeBadge type={batch.batchType} />
                    {batch.school && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <GraduationCap className="w-3 h-3" />
                        {batch.school.name}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {(batch.status === 'IN_PROGRESS' || batch.status === 'COMPLETED') && total > 0 && (
                    <ProgressBar processed={processed} total={total} type={batch.batchType} />
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </span>
                    {batch.schoolYear && (
                      <span>{batch.schoolYear}</span>
                    )}
                    {batch.grade && (
                      <span>Grade {batch.grade}</span>
                    )}
                    {total > 0 && (
                      <span>{total} device{total !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
