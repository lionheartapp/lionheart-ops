'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutList, CalendarDays, Filter } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { COMPLIANCE_DOMAIN_DEFAULTS, COMPLIANCE_DOMAINS } from '@/lib/types/compliance'
import type { ComplianceDomain, ComplianceStatus, ComplianceOutcome } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceRecord {
  id: string
  domain: ComplianceDomain
  title: string
  dueDate: string
  inspectionDate?: string | null
  outcome: ComplianceOutcome
  status: ComplianceStatus
  inspector?: string | null
  notes?: string | null
  school?: { id: string; name: string } | null
}

interface ComplianceCalendarProps {
  onEditRecord?: (record: ComplianceRecord) => void
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const config: Record<ComplianceStatus, { label: string; className: string }> = {
    CURRENT: { label: 'Current', className: 'bg-green-100 text-green-700' },
    DUE_SOON: { label: 'Due Soon', className: 'bg-amber-100 text-amber-700' },
    OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
    NOT_APPLICABLE: { label: 'N/A', className: 'bg-gray-100 text-gray-500' },
    PENDING: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
  }
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function OutcomeBadge({ outcome }: { outcome: ComplianceOutcome }) {
  const config: Record<ComplianceOutcome, { label: string; className: string }> = {
    PASSED: { label: 'Passed', className: 'bg-green-100 text-green-700' },
    FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
    CONDITIONAL_PASS: { label: 'Conditional', className: 'bg-amber-100 text-amber-700' },
    PENDING: { label: 'Pending', className: 'bg-gray-100 text-gray-500' },
  }
  const { label, className } = config[outcome]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-100">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-200 rounded flex-1" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ComplianceCalendar({ onEditRecord }: ComplianceCalendarProps) {
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')
  const [filterDomain, setFilterDomain] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  // Current school year date range
  const now = new Date()
  const schoolYearStart = now.getMonth() >= 7
    ? new Date(now.getFullYear(), 7, 1)
    : new Date(now.getFullYear() - 1, 7, 1)
  const schoolYearEnd = new Date(schoolYearStart.getFullYear() + 1, 6, 31)

  const fromStr = schoolYearStart.toISOString().split('T')[0]
  const toStr = schoolYearEnd.toISOString().split('T')[0]

  const params = new URLSearchParams({ from: fromStr, to: toStr })
  if (filterDomain) params.set('domain', filterDomain)
  if (filterStatus) params.set('status', filterStatus)

  const { data: recordsData, isLoading } = useQuery<{ data: ComplianceRecord[] }>({
    queryKey: ['compliance-records', fromStr, toStr, filterDomain, filterStatus],
    queryFn: () => fetchApi<{ data: ComplianceRecord[] }>(`/api/maintenance/compliance/records?${params.toString()}`),
  })

  const records: ComplianceRecord[] = recordsData?.data ?? []

  // ─── List View ────────────────────────────────────────────────────────────

  const renderListView = () => {
    if (records.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">No compliance deadlines found</p>
          <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
            Configure your domains above, then click &quot;Populate Calendar for This Year&quot; to generate deadlines.
          </p>
        </div>
      )
    }

    return (
      <div className="ui-glass-table rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inspection</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Outcome</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inspector</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((record) => {
              const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]
              const dueDate = new Date(record.dueDate)
              const isOverdue = dueDate < now && record.outcome === 'PENDING'

              return (
                <tr
                  key={record.id}
                  onClick={() => onEditRecord?.(record)}
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 text-xs">{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{record.title}</td>
                  <td className={`px-4 py-3 font-medium text-xs ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                    {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={record.outcome} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {record.inspector ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditRecord?.(record)
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Timeline View ────────────────────────────────────────────────────────

  const renderTimelineView = () => {
    // Group records by month
    const byMonth: Record<string, ComplianceRecord[]> = {}
    for (const record of records) {
      const date = new Date(record.dueDate)
      const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!byMonth[key]) byMonth[key] = []
      byMonth[key].push(record)
    }

    if (Object.keys(byMonth).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">No compliance deadlines found</p>
          <p className="text-xs text-gray-400 max-w-xs">Configure domains and populate the calendar to see deadlines here.</p>
        </div>
      )
    }

    const STATUS_COLORS: Record<ComplianceStatus, string> = {
      CURRENT: 'bg-green-500',
      DUE_SOON: 'bg-amber-500',
      OVERDUE: 'bg-red-500',
      NOT_APPLICABLE: 'bg-gray-300',
      PENDING: 'bg-blue-500',
    }

    return (
      <div className="space-y-4">
        {Object.entries(byMonth).map(([month, monthRecords]) => (
          <div key={month} className="ui-glass rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">{month}</h4>
            <div className="space-y-2">
              {monthRecords.map((record) => {
                const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]
                return (
                  <div
                    key={record.id}
                    onClick={() => onEditRecord?.(record)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[record.status]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{meta.label}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(record.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {record.school && ` — ${record.school.name}`}
                      </p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="ui-glass p-3 rounded-xl mb-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />

        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
        >
          <option value="">All Domains</option>
          {COMPLIANCE_DOMAINS.map((d) => (
            <option key={d} value={d}>{COMPLIANCE_DOMAIN_DEFAULTS[d].label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="DUE_SOON">Due Soon</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CURRENT">Current</option>
        </select>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'list' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="List view"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'timeline' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="Timeline view"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <CalendarSkeleton />
      ) : viewMode === 'list' ? (
        renderListView()
      ) : (
        renderTimelineView()
      )}

      {/* Summary */}
      {!isLoading && records.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {records.length} deadline{records.length === 1 ? '' : 's'} in school year {schoolYearStart.getFullYear()}–{schoolYearEnd.getFullYear()}
        </p>
      )}
    </div>
  )
}
