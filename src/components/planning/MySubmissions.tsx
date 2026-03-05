'use client'

import { useState } from 'react'
import type { PlanningSubmission } from '@/lib/hooks/usePlanningSeason'

interface MySubmissionsProps {
  submissions: PlanningSubmission[]
  onSubmit: (id: string) => void
  onSelect: (submission: PlanningSubmission) => void
  isSubmitting?: boolean
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED_IN_PRINCIPLE: { label: 'Approved in Principle', color: 'bg-green-100 text-green-700' },
  NEEDS_REVISION: { label: 'Needs Revision', color: 'bg-orange-100 text-orange-700' },
  DECLINED: { label: 'Declined', color: 'bg-red-100 text-red-700' },
  FINALIZING: { label: 'Finalizing', color: 'bg-purple-100 text-purple-700' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', color: 'bg-indigo-100 text-indigo-700' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  PUBLISHED: { label: 'Published', color: 'bg-emerald-100 text-emerald-700' },
}

const PRIORITY_COLORS: Record<string, string> = {
  MUST_HAVE: 'text-red-600',
  IMPORTANT: 'text-yellow-600',
  NICE_TO_HAVE: 'text-gray-500',
}

export default function MySubmissions({ submissions, onSubmit, onSelect, isSubmitting }: MySubmissionsProps) {
  const [filterStatus, setFilterStatus] = useState<string>('')

  const filtered = filterStatus ? submissions.filter((s) => s.submissionStatus === filterStatus) : submissions

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterStatus('')} className={`px-3 py-1 text-xs rounded-full border transition ${!filterStatus ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border-gray-200'}`}>All ({submissions.length})</button>
        {Object.entries(STATUS_BADGES).map(([key, badge]) => {
          const count = submissions.filter((s) => s.submissionStatus === key).length
          if (count === 0) return null
          return (
            <button key={key} onClick={() => setFilterStatus(key)} className={`px-3 py-1 text-xs rounded-full border transition ${filterStatus === key ? 'bg-gray-900 text-white' : `bg-white ${badge.color} border-gray-200`}`}>
              {badge.label} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No submissions found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub) => {
            const badge = STATUS_BADGES[sub.submissionStatus] || STATUS_BADGES.DRAFT
            return (
              <div key={sub.id} onClick={() => onSelect(sub)} className="ui-glass-hover p-4 cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{sub.title}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>{badge.label}</span>
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[sub.priority] || ''}`}>{sub.priority.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(sub.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{sub.duration}min
                      {sub.expectedAttendance ? ` · ~${sub.expectedAttendance} attendees` : ''}
                      {sub._count?.comments ? ` · ${sub._count.comments} comments` : ''}
                    </p>
                  </div>
                  {sub.submissionStatus === 'DRAFT' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSubmit(sub.id) }}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 disabled:opacity-50 transition flex-shrink-0"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
