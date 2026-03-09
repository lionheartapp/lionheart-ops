'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import {
  UserCog, Settings, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Clock, Loader2, ChevronDown, Search,
} from 'lucide-react'
import { IllustrationDeployment } from '@/components/illustrations'

interface ITProvisioningTabProps {
  canManage: boolean
  canView: boolean
}

interface ProvisioningConfig {
  autoEnrollEnabled: boolean
  autoSuspendEnabled: boolean
  orphanDetectionEnabled: boolean
  graduationArchiveEnabled: boolean
  staffOnboardingEnabled: boolean
  defaultOuPath: string | null
  suspendedOuPath: string | null
}

interface ProvisioningEvent {
  id: string
  eventType: string
  status: string
  studentId: string | null
  userId: string | null
  details: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: string
  processedAt: string | null
}

interface OrphanedAccount {
  id: string
  email: string
  accountType: string
  source: string
  detectedAt: string
  resolvedAt: string | null
  resolution: string | null
  notes: string | null
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  NEW_ENROLLMENT: 'New Enrollment',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  GRADUATION: 'Graduation',
  ORPHANED_DETECTED: 'Orphaned Detected',
  STAFF_ONBOARDING: 'Staff Onboarding',
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  FAILED: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
  SKIPPED: { label: 'Skipped', color: 'text-gray-700', bg: 'bg-gray-100' },
}

export default function ITProvisioningTab({ canManage, canView }: ITProvisioningTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Config
  const { data: config, isLoading: configLoading } = useQuery({
    ...queryOptions.itProvisioningConfig(),
    enabled: canManage,
  })

  // Events
  const filters: Record<string, string> = {}
  if (eventTypeFilter) filters.eventType = eventTypeFilter
  if (statusFilter) filters.status = statusFilter

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    ...queryOptions.itProvisioningEvents(filters),
    enabled: canView,
  })

  // Orphaned accounts
  const { data: orphanedAccounts = [], isLoading: orphanedLoading } = useQuery({
    ...queryOptions.itOrphanedAccounts(),
    enabled: canView,
  })

  // Toggle config mutation
  const toggleConfig = useMutation({
    mutationFn: async (update: Partial<ProvisioningConfig>) => {
      const res = await fetch('/api/it/provisioning/config', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      if (!res.ok) throw new Error('Failed to update config')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itProvisioningConfig.all })
      toast('Configuration updated')
    },
    onError: () => toast('Failed to update config'),
  })

  // Resolve orphaned account
  const resolveOrphaned = useMutation({
    mutationFn: async ({ id, action, notes }: { id: string; action: string; notes?: string }) => {
      const res = await fetch(`/api/it/provisioning/orphaned/${id}/resolve`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      })
      if (!res.ok) throw new Error('Failed to resolve')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itOrphanedAccounts.all })
      toast('Account resolved')
    },
    onError: () => toast('Failed to resolve account'),
  })

  const typedConfig = config as ProvisioningConfig | undefined
  const typedEvents = (eventsData as { events: ProvisioningEvent[]; total: number } | undefined)?.events || []
  const typedOrphaned = orphanedAccounts as OrphanedAccount[]

  const configToggles = [
    { key: 'autoEnrollEnabled' as const, label: 'Auto-Enroll', desc: 'Automatically provision accounts for new enrollments' },
    { key: 'autoSuspendEnabled' as const, label: 'Auto-Suspend', desc: 'Suspend accounts when students transfer out' },
    { key: 'orphanDetectionEnabled' as const, label: 'Orphan Detection', desc: 'Weekly scan for accounts with no SIS match' },
    { key: 'graduationArchiveEnabled' as const, label: 'Graduation Archive', desc: 'Batch archive accounts at graduation' },
    { key: 'staffOnboardingEnabled' as const, label: 'Staff Onboarding', desc: 'Auto-create IT setup ticket for new staff' },
  ]

  return (
    <div className="space-y-6">
      {/* Config Section */}
      {canManage && (
        <div className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Automation Settings</h3>
          </div>
          {configLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {configToggles.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggleConfig.mutate({ [key]: !(typedConfig?.[key] ?? false) })}
                    disabled={toggleConfig.isPending}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      typedConfig?.[key] ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      typedConfig?.[key] ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event Log */}
      {canView && (
        <div className="ui-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-gray-700" />
              <h3 className="text-sm font-semibold text-gray-900">Provisioning Events</h3>
            </div>
            <div className="flex gap-2">
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Types</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : typedEvents.length === 0 ? (
            <div className="text-center py-8">
              <IllustrationDeployment className="w-40 h-32 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No provisioning events yet</p>
              <p className="text-xs text-gray-400 mt-1">Events will appear here when provisioning actions are triggered</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Details</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {typedEvents.map((event) => {
                    const statusCfg = STATUS_LABELS[event.status] || STATUS_LABELS.PENDING
                    return (
                      <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900">{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 max-w-[200px] truncate">
                          {event.errorMessage || (event.details as Record<string, unknown>)?.action?.toString() || '—'}
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Orphaned Accounts */}
      {canView && (
        <div className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Orphaned Accounts</h3>
            <span className="text-xs text-gray-400 ml-1">
              Accounts with no matching SIS record
            </span>
          </div>

          {orphanedLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : typedOrphaned.length === 0 ? (
            <div className="text-center py-8">
              <IllustrationDeployment className="w-40 h-32 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No orphaned accounts</p>
              <p className="text-xs text-gray-400 mt-1">All directory accounts have matching SIS records</p>
            </div>
          ) : (
            <div className="space-y-2">
              {typedOrphaned.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.email}</p>
                    <p className="text-xs text-gray-500">
                      {account.accountType} · {account.source} · Detected {new Date(account.detectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => resolveOrphaned.mutate({ id: account.id, action: 'keep' })}
                        disabled={resolveOrphaned.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => resolveOrphaned.mutate({ id: account.id, action: 'suspend' })}
                        disabled={resolveOrphaned.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                      >
                        Suspend
                      </button>
                      <button
                        onClick={() => resolveOrphaned.mutate({ id: account.id, action: 'delete' })}
                        disabled={resolveOrphaned.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
