'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import ITMdmConfigSection from './ITMdmConfigSection'
import { IllustrationSync } from '@/components/illustrations'
import {
  RefreshCw,
  Cloud,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Settings,
  Play,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface ITSyncConfig {
  id: string
  provider: string
  isEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  syncSchedule: string | null
  settings: Record<string, unknown> | null
}

interface ITSyncJob {
  id: string
  provider: string
  jobType: string
  status: string
  startedAt: string | null
  completedAt: string | null
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  errors: unknown[] | null
  createdAt: string
}

interface ITSyncTabProps {
  canManage: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  google_admin: 'Google Admin',
  clever: 'Clever',
  classlink: 'ClassLink',
}

const PROVIDER_ICONS: Record<string, typeof Cloud> = {
  google_admin: Cloud,
  clever: RefreshCw,
  classlink: Settings,
}

const JOB_TYPE_LABELS: Record<string, string> = {
  device_sync: 'Device Sync',
  roster_sync: 'Roster Sync',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot?: string }> = {
  PENDING: { bg: 'bg-slate-100', text: 'text-slate-700' },
  RUNNING: { bg: 'bg-blue-100', text: 'text-blue-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700' },
}

const PROVIDER_FILTER_OPTIONS = [
  { value: '', label: 'All Providers' },
  { value: 'google_admin', label: 'Google Admin' },
  { value: 'clever', label: 'Clever' },
  { value: 'classlink', label: 'ClassLink' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
]

// ─── Helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '—'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return '<1s'
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remainSecs = secs % 60
  return `${mins}m ${remainSecs}s`
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getTriggerEndpoint(provider: string): string {
  if (provider === 'google_admin') return '/api/it/sync/google/trigger'
  return '/api/it/sync/roster/trigger'
}

// ─── Status Badge ───────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {status === 'RUNNING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'FAILED' && <XCircle className="w-3 h-3" />}
      {status === 'PENDING' && <Clock className="w-3 h-3" />}
      {status}
    </span>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function SyncTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ui-glass p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-slate-200 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="w-24 h-4 bg-slate-200 rounded" />
                <div className="w-16 h-3 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="w-full h-8 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
      <div className="ui-glass-table animate-pulse">
        <div className="h-10 bg-slate-100 border-b border-slate-200/50" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 border-b border-slate-100/50 flex items-center px-4 gap-4">
            <div className="w-20 h-3 bg-slate-100 rounded" />
            <div className="w-16 h-3 bg-slate-100 rounded" />
            <div className="w-16 h-5 bg-slate-100 rounded-md" />
            <div className="w-24 h-3 bg-slate-100 rounded" />
            <div className="w-16 h-3 bg-slate-100 rounded" />
            <div className="w-12 h-3 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITSyncTab({ canManage }: ITSyncTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Filters ─────────────────────────────────────────────────────────
  const [providerFilter, setProviderFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const jobFilters = useMemo(() => {
    const f: Record<string, string> = {}
    if (providerFilter) f.provider = providerFilter
    if (statusFilter) f.status = statusFilter
    f.limit = String(pageSize)
    f.offset = String(page * pageSize)
    return f
  }, [providerFilter, statusFilter, page])

  // ── Queries ─────────────────────────────────────────────────────────
  const { data: configsRaw, isLoading: configsLoading } = useQuery(queryOptions.itSyncConfigs())
  const { data: jobsRaw, isLoading: jobsLoading } = useQuery(queryOptions.itSyncJobs(jobFilters))

  const configs = (configsRaw as ITSyncConfig[] | undefined) ?? []
  const jobsResult = jobsRaw as { jobs?: ITSyncJob[]; total?: number } | ITSyncJob[] | undefined
  const jobs = Array.isArray(jobsResult) ? jobsResult : (jobsResult?.jobs ?? [])
  const jobsTotal = Array.isArray(jobsResult) ? jobsResult.length : (jobsResult?.total ?? jobs.length)
  const totalPages = Math.ceil(jobsTotal / pageSize)

  // ── Mutations ───────────────────────────────────────────────────────
  const triggerSyncMutation = useMutation({
    mutationFn: async (provider: string) => {
      const endpoint = getTriggerEndpoint(provider)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to trigger sync')
      }
      return res.json()
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSyncJobs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itSyncConfigs.all })
      toast(`${PROVIDER_LABELS[provider] ?? provider} sync triggered`, 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const toggleEnableMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await fetch(`/api/it/sync/configs/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isEnabled }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to update config')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itSyncConfigs.all })
      toast('Sync config updated', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  // ── Loading ─────────────────────────────────────────────────────────
  if (configsLoading && jobsLoading) return <SyncTabSkeleton />

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* ─── Sync Providers ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Sync Providers</h3>

        {configs.length === 0 ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationSync className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 mb-1">No sync providers configured</p>
            <p className="text-xs text-slate-400 mt-1">
              Set up Google Admin, Clever, or ClassLink to sync data automatically
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((config) => {
              const Icon = PROVIDER_ICONS[config.provider] ?? Cloud
              const label = PROVIDER_LABELS[config.provider] ?? config.provider
              const isSyncing =
                triggerSyncMutation.isPending &&
                triggerSyncMutation.variables === config.provider

              return (
                <div key={config.id} className="ui-glass p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-50/80 to-primary-100/80 border border-primary-200/30 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-400">
                          {config.syncSchedule ?? 'Manual sync'}
                        </p>
                      </div>
                    </div>

                    {/* Enable/Disable toggle */}
                    {canManage && (
                      <button
                        onClick={() =>
                          toggleEnableMutation.mutate({
                            id: config.id,
                            isEnabled: !config.isEnabled,
                          })
                        }
                        disabled={toggleEnableMutation.isPending}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          config.isEnabled ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                        aria-label={config.isEnabled ? 'Disable sync' : 'Enable sync'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            config.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Last sync info */}
                  <div className="flex items-center gap-2 mb-4">
                    {config.lastSyncStatus ? (
                      <SyncStatusBadge status={config.lastSyncStatus} />
                    ) : (
                      <span className="text-xs text-slate-400">No sync history</span>
                    )}
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(config.lastSyncAt)}
                    </span>
                  </div>

                  {config.lastSyncError && (
                    <p className="text-xs text-red-500 mb-3 line-clamp-2" title={config.lastSyncError}>
                      {config.lastSyncError}
                    </p>
                  )}

                  {/* Sync Now button */}
                  {canManage && (
                    <button
                      onClick={() => triggerSyncMutation.mutate(config.provider)}
                      disabled={isSyncing || !config.isEnabled}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Sync Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── MDM Configuration ──────────────────────────────────────── */}
      <ITMdmConfigSection canManage={canManage} />

      {/* ─── Sync History ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Sync History</h3>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setPage(0) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            {PROVIDER_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {jobs.length === 0 ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationSync className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 mb-1">No sync jobs found</p>
            <p className="text-xs text-slate-400 mt-1">
              Trigger a sync above to see job history here
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-2">
              {jobsTotal} job{jobsTotal !== 1 ? 's' : ''}
            </p>

            {/* Desktop table */}
            <div className="hidden sm:block ui-glass-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200/50">
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Job Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Started</th>
                    <th className="px-4 py-3 font-medium">Records</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-slate-100/50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-700">
                        {PROVIDER_LABELS[job.provider] ?? job.provider}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                      </td>
                      <td className="px-4 py-3">
                        <SyncStatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(job.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs">
                          {job.recordsCreated > 0 && (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 bg-green-100 text-green-700 font-medium">
                              +{job.recordsCreated}
                            </span>
                          )}
                          {job.recordsUpdated > 0 && (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 bg-blue-100 text-blue-700 font-medium">
                              ~{job.recordsUpdated}
                            </span>
                          )}
                          {job.recordsSkipped > 0 && (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 bg-slate-100 text-slate-600 font-medium">
                              {job.recordsSkipped} skipped
                            </span>
                          )}
                          {job.recordsCreated === 0 &&
                            job.recordsUpdated === 0 &&
                            job.recordsSkipped === 0 && (
                              <span className="text-slate-400">—</span>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="ui-glass p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900">
                      {PROVIDER_LABELS[job.provider] ?? job.provider}
                    </span>
                    <SyncStatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mb-2">
                    <span>{JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</span>
                    <span>{formatDateTime(job.startedAt)}</span>
                    <span>{formatDuration(job.startedAt, job.completedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {job.recordsCreated > 0 && (
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 bg-green-100 text-green-700 font-medium">
                        +{job.recordsCreated} created
                      </span>
                    )}
                    {job.recordsUpdated > 0 && (
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 bg-blue-100 text-blue-700 font-medium">
                        ~{job.recordsUpdated} updated
                      </span>
                    )}
                    {job.recordsSkipped > 0 && (
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 bg-slate-100 text-slate-600 font-medium">
                        {job.recordsSkipped} skipped
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
