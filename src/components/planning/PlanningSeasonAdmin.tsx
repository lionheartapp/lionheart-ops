'use client'

import { useState } from 'react'
import type { PlanningSeason, PlanningSubmission } from '@/lib/hooks/usePlanningSeason'
import { useSubmissions, useTransitionPhase, useReviewSubmission, useBulkPublish, useConflicts } from '@/lib/hooks/usePlanningSeason'

interface PlanningSeasonAdminProps {
  season: PlanningSeason
  onSelectSubmission: (submission: PlanningSubmission) => void
}

const PHASE_ORDER = ['SETUP', 'COLLECTING', 'REVIEWING', 'WAR_ROOM', 'FINALIZING', 'APPROVING', 'CLOSED']

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  SETUP: { label: 'Setup', color: 'bg-gray-100 text-gray-700' },
  COLLECTING: { label: 'Collecting', color: 'bg-blue-100 text-blue-700' },
  REVIEWING: { label: 'Reviewing', color: 'bg-yellow-100 text-yellow-700' },
  WAR_ROOM: { label: 'War Room', color: 'bg-red-100 text-red-700' },
  FINALIZING: { label: 'Finalizing', color: 'bg-purple-100 text-purple-700' },
  APPROVING: { label: 'Approving', color: 'bg-indigo-100 text-indigo-700' },
  CLOSED: { label: 'Closed', color: 'bg-green-100 text-green-700' },
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED_IN_PRINCIPLE: 'bg-green-100 text-green-700',
  NEEDS_REVISION: 'bg-orange-100 text-orange-700',
  DECLINED: 'bg-red-100 text-red-700',
  APPROVED: 'bg-green-100 text-green-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
}

export default function PlanningSeasonAdmin({ season, onSelectSubmission }: PlanningSeasonAdminProps) {
  const { data: submissions = [] } = useSubmissions(season.id)
  const { data: conflicts = [] } = useConflicts(season.id)
  const transitionPhase = useTransitionPhase()
  const reviewMutation = useReviewSubmission()
  const publishMutation = useBulkPublish()
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  const currentPhaseIdx = PHASE_ORDER.indexOf(season.phase)
  const nextPhase = PHASE_ORDER[currentPhaseIdx + 1] || null

  const handleAdvancePhase = () => {
    if (!nextPhase) return
    transitionPhase.mutate({ id: season.id, phase: nextPhase })
  }

  const handleReview = (subId: string, status: string) => {
    reviewMutation.mutate({
      seasonId: season.id,
      subId,
      data: { status, adminNotes: adminNotes || undefined },
    })
    setReviewingId(null)
    setAdminNotes('')
  }

  const phaseInfo = PHASE_LABELS[season.phase] || PHASE_LABELS.SETUP
  const unresolvedConflicts = conflicts.filter((c) => !c.isResolved)

  return (
    <div className="space-y-6">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{season.name}</h3>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${phaseInfo.color}`}>{phaseInfo.label}</span>
        </div>
        {nextPhase && (
          <button
            onClick={handleAdvancePhase}
            disabled={transitionPhase.isPending}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
          >
            Advance to {PHASE_LABELS[nextPhase]?.label || nextPhase}
          </button>
        )}
      </div>

      {/* Phase Progress */}
      <div className="flex items-center gap-1">
        {PHASE_ORDER.map((phase, idx) => (
          <div key={phase} className={`flex-1 h-2 rounded-full ${idx <= currentPhaseIdx ? 'bg-gray-900' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{submissions.length}</div>
          <div className="text-xs text-gray-500">Total Submissions</div>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{submissions.filter((s) => s.submissionStatus === 'APPROVED').length}</div>
          <div className="text-xs text-gray-500">Approved</div>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{submissions.filter((s) => s.submissionStatus === 'SUBMITTED').length}</div>
          <div className="text-xs text-gray-500">Awaiting Review</div>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{unresolvedConflicts.length}</div>
          <div className="text-xs text-gray-500">Conflicts</div>
        </div>
      </div>

      {/* Bulk Publish (when in APPROVING phase) */}
      {season.phase === 'APPROVING' && submissions.some((s) => s.submissionStatus === 'APPROVED') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              {submissions.filter((s) => s.submissionStatus === 'APPROVED').length} submissions ready to publish
            </p>
            <p className="text-xs text-blue-700">This will create calendar events for all approved submissions</p>
          </div>
          <button
            onClick={() => publishMutation.mutate({ seasonId: season.id, calendarId: '' })}
            disabled={publishMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {publishMutation.isPending ? 'Publishing...' : 'Bulk Publish'}
          </button>
        </div>
      )}

      {/* Submissions List */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Submissions</h4>
        {submissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No submissions yet</div>
        ) : (
          <div className="space-y-2">
            {submissions.map((sub) => (
              <div key={sub.id} className="border border-gray-200 rounded-xl p-3 bg-white hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectSubmission(sub)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">{sub.title}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[sub.submissionStatus] || ''}`}>
                        {sub.submissionStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      By {sub.submittedBy.firstName} {sub.submittedBy.lastName} · {new Date(sub.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>

                  {sub.submissionStatus === 'SUBMITTED' && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {reviewingId === sub.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Notes..." aria-label="Admin notes" className="w-32 px-2 py-1 border border-gray-200 rounded text-xs" />
                          <button onClick={() => handleReview(sub.id, 'APPROVED_IN_PRINCIPLE')} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Approve</button>
                          <button onClick={() => handleReview(sub.id, 'NEEDS_REVISION')} className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600">Revise</button>
                          <button onClick={() => handleReview(sub.id, 'DECLINED')} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">Decline</button>
                          <button onClick={() => setReviewingId(null)} className="text-xs text-gray-400">×</button>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(sub.id)} className="px-3 py-1 text-xs text-blue-600 font-medium hover:text-blue-800">Review</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
