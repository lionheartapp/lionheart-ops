'use client'

import { useState } from 'react'
import { useSubmissions } from '@/lib/hooks/usePlanningSeason'
import { CheckCircle, Clock, XCircle, AlertCircle, Calendar, Edit, Eye } from 'lucide-react'

interface MyEventsTabProps {
  seasonId: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  DRAFT: { label: 'Draft', color: '#64748b', bgColor: '#f1f5f9', icon: Edit },
  SUBMITTED: { label: 'Submitted', color: '#3b82f6', bgColor: '#eff6ff', icon: Clock },
  IN_REVIEW: { label: 'In Review', color: '#8b5cf6', bgColor: '#f5f3ff', icon: Eye },
  APPROVED: { label: 'Approved', color: '#22c55e', bgColor: '#f0fdf4', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: '#ef4444', bgColor: '#fef2f2', icon: XCircle },
  REVISION_REQUESTED: { label: 'Needs Revision', color: '#f59e0b', bgColor: '#fffbeb', icon: AlertCircle },
}

export default function MyEventsTab({ seasonId }: MyEventsTabProps) {
  const { data: submissions = [], isLoading } = useSubmissions(seasonId)
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.submissionStatus === filter)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'All' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'SUBMITTED', label: 'Pending' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'DRAFT', label: 'Drafts' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === opt.value
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
            {opt.value === 'all'
              ? ` (${submissions.length})`
              : ` (${submissions.filter((s) => s.submissionStatus === opt.value).length})`}
          </button>
        ))}
      </div>

      {/* Submission list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No submissions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((submission) => {
            const config = STATUS_CONFIG[submission.submissionStatus] || STATUS_CONFIG.DRAFT
            const Icon = config.icon
            const preferredDate = submission.preferredDate
              ? new Date(submission.preferredDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : null

            return (
              <div
                key={submission.id}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: config.bgColor }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{submission.title}</h4>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config.bgColor, color: config.color }}
                      >
                        {config.label}
                      </span>
                    </div>
                    {submission.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mb-1">{submission.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {preferredDate && <span>{preferredDate}</span>}
                      {submission.duration && <span>{submission.duration}min</span>}
                      {submission.priority && (
                        <span className="capitalize">{submission.priority.toLowerCase()} priority</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
