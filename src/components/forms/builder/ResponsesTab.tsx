'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Inbox,
  Download,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  X,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { SearchInput } from '@/components/ui/SearchInput'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Submission {
  id: string
  submitterName: string | null
  submitterEmail: string | null
  data: Record<string, unknown>
  status: string
  isDraft: boolean
  createdAt: string
}

interface SubmissionCounts {
  total: number
  submitted: number
  approved: number
  rejected: number
  draft: number
}

interface SubmissionsData {
  submissions: Submission[]
  counts: SubmissionCounts
}

// ─── Submission Detail Drawer ─────────────────────────────────────────────

function SubmissionDrawer({
  submission,
  onClose,
}: {
  submission: Submission
  onClose: () => void
}) {
  const entries = Object.entries(submission.data).filter(
    ([key]) => !key.startsWith('_')
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.3 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-xl z-50 overflow-y-auto"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Response Details
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Submitter */}
          <div>
            <p className="text-sm font-medium text-slate-900">
              {submission.submitterName || 'Anonymous'}
            </p>
            {submission.submitterEmail && (
              <p className="text-xs text-slate-500">
                {submission.submitterEmail}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {new Date(submission.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Status */}
          <div>
            <StatusBadge status={submission.status} isDraft={submission.isDraft} />
          </div>

          {/* Field values */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Responses
            </h4>
            {entries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No field data</p>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100">
                {entries.map(([key, value]) => (
                  <div key={key} className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">
                      {formatFieldKey(key)}
                    </p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">
                      {formatFieldValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase())
}

function formatFieldValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function StatusBadge({ status, isDraft }: { status: string; isDraft: boolean }) {
  if (isDraft) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
        <FileText className="w-3 h-3" /> Draft
      </span>
    )
  }
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
      <Clock className="w-3 h-3" /> Submitted
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

interface ResponsesTabProps {
  formId: string
}

export default function ResponsesTab({ formId }: ResponsesTabProps) {
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<SubmissionsData>({
    queryKey: ['forms', formId, 'submissions', search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const qs = params.toString()
      return fetchApi<SubmissionsData>(
        `/api/forms/${formId}/submissions${qs ? `?${qs}` : ''}`
      )
    },
    staleTime: 15_000,
  })

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  const submissions = data?.submissions ?? []
  const counts = data?.counts ?? {
    total: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        {/* ── Summary Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Total</span>
            <p className="text-lg font-bold text-slate-900">{counts.total}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Submitted</span>
            <p className="text-lg font-bold text-slate-900">
              {counts.submitted}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Approved</span>
            <p className="text-lg font-bold text-emerald-600">
              {counts.approved}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Drafts</span>
            <p className="text-lg font-bold text-slate-400">{counts.draft}</p>
          </div>
        </div>

        {/* ── Search + Export ─────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Search by name or email..."
              size="sm"
            />
          </div>
          <button
            onClick={() =>
              window.open(
                `/api/forms/${formId}/submissions/export`,
                '_blank'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        {/* ── Submissions List ────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Inbox className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                No responses yet
              </h3>
              <p className="text-xs text-slate-500 max-w-xs">
                Responses will appear here when someone submits this form.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {submissions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubmission(sub)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {sub.submitterName || sub.submitterEmail || 'Anonymous'}
                      </span>
                      <StatusBadge
                        status={sub.status}
                        isDraft={sub.isDraft}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(sub.createdAt).toLocaleDateString()}{' '}
                      {new Date(sub.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submission detail drawer */}
      {selectedSubmission && (
        <SubmissionDrawer
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  )
}
