'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Download, Search, ChevronDown, Inbox } from 'lucide-react'
import { useFormSubmissions, type FormSubmission } from '@/lib/hooks/useFormSubmissions'
import SubmissionStatusBadge from './SubmissionStatusBadge'
import { SearchInput } from '@/components/ui/SearchInput'
import type { SubmissionStatus } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormSubmissionsTableProps {
  formId: string
  /** Field keys + labels to show as columns */
  fieldColumns: Array<{ key: string; label: string }>
  /** Called when a row is clicked */
  onSelect?: (submission: FormSubmission) => void
  /** Max columns from form fields to show (default 4) */
  maxFieldColumns?: number
}

// ─── Status Filter Tabs ──────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ value: SubmissionStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DRAFT', label: 'Drafts' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormSubmissionsTable({
  formId,
  fieldColumns,
  onSelect,
  maxFieldColumns = 4,
}: FormSubmissionsTableProps) {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useFormSubmissions(formId, {
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    search: search || undefined,
    isDraft: statusFilter === 'DRAFT' ? true : undefined,
  })

  const submissions = data?.submissions ?? []
  const counts = data?.counts ?? { total: 0, pending: 0, draft: 0 }
  const visibleColumns = fieldColumns.slice(0, maxFieldColumns)

  const exportUrl = `/api/forms/${formId}/submissions/export`

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === f.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
              {f.value === 'PENDING_APPROVAL' && counts.pending > 0 && (
                <span className="ml-1 text-amber-600">{counts.pending}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search submissions..."
            size="sm"
            onClear={search ? () => setSearch('') : undefined}
          />
          <a
            href={exportUrl}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </a>
        </div>
      </div>

      {/* Counts summary */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{counts.total} submission{counts.total !== 1 ? 's' : ''}</span>
        {counts.pending > 0 && (
          <span className="text-amber-600">{counts.pending} pending approval</span>
        )}
        {counts.draft > 0 && (
          <span>{counts.draft} draft{counts.draft !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Date
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Submitter
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Status
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide max-w-[200px] truncate"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <>
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={3 + visibleColumns.length} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {!isLoading && submissions.length === 0 && (
              <tr>
                <td
                  colSpan={3 + visibleColumns.length}
                  className="px-4 py-12 text-center"
                >
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No submissions yet</p>
                </td>
              </tr>
            )}

            {submissions.map((sub) => {
              const data = (sub.data ?? {}) as Record<string, unknown>
              return (
                <tr
                  key={sub.id}
                  onClick={() => onSelect?.(sub)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {format(new Date(sub.createdAt), 'MMM d, yyyy')}
                    <span className="text-slate-400 ml-1">
                      {format(new Date(sub.createdAt), 'h:mm a')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium">
                      {sub.submitterName || 'Anonymous'}
                    </div>
                    {sub.submitterEmail && (
                      <div className="text-xs text-slate-500">{sub.submitterEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SubmissionStatusBadge status={sub.status} />
                  </td>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-slate-600 max-w-[200px] truncate"
                    >
                      {formatFieldValue(data[col.key])}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFieldValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
