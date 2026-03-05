'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Edit2, Trash2, RotateCcw, MoreVertical, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react'
import type { PlanningSeason, PlanningSubmission } from '@/lib/hooks/usePlanningSeason'
import { useSubmissions, useTransitionPhase, useReviewSubmission, useBulkPublish, useConflicts, useUpdateSeason, useDeleteSeason } from '@/lib/hooks/usePlanningSeason'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput } from '@/components/ui/FloatingInput'

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

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  IMPORTANT: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export default function PlanningSeasonAdmin({ season, onSelectSubmission }: PlanningSeasonAdminProps) {
  const { data: submissions = [] } = useSubmissions(season.id)
  const { data: conflicts = [] } = useConflicts(season.id)
  const transitionPhase = useTransitionPhase()
  const reviewMutation = useReviewSubmission()
  const publishMutation = useBulkPublish()
  const updateSeason = useUpdateSeason()
  const deleteSeason = useDeleteSeason()

  // Dialogs / drawers state
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showGoBackDialog, setShowGoBackDialog] = useState(false)
  const [showReopenDialog, setShowReopenDialog] = useState(false)

  // Review dialog state
  const [reviewTarget, setReviewTarget] = useState<{ sub: PlanningSubmission; action: string } | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  // Edit form state
  const [editName, setEditName] = useState(season.name)
  const [editStartDate, setEditStartDate] = useState(season.startDate?.slice(0, 10) || '')
  const [editEndDate, setEditEndDate] = useState(season.endDate?.slice(0, 10) || '')
  const [editSubOpen, setEditSubOpen] = useState(season.submissionOpen?.slice(0, 10) || '')
  const [editSubClose, setEditSubClose] = useState(season.submissionClose?.slice(0, 10) || '')
  const [editBudgetCap, setEditBudgetCap] = useState(season.budgetCap?.toString() || '')

  const currentPhaseIdx = PHASE_ORDER.indexOf(season.phase)
  const nextPhase = PHASE_ORDER[currentPhaseIdx + 1] || null
  const prevPhase = currentPhaseIdx > 0 ? PHASE_ORDER[currentPhaseIdx - 1] : null

  const handleAdvancePhase = () => {
    if (!nextPhase) return
    transitionPhase.mutate({ id: season.id, phase: nextPhase })
  }

  const handleGoBack = () => {
    if (!prevPhase) return
    transitionPhase.mutate({ id: season.id, phase: prevPhase }, {
      onSuccess: () => setShowGoBackDialog(false),
    })
  }

  const handleReopen = () => {
    transitionPhase.mutate({ id: season.id, phase: 'APPROVING' }, {
      onSuccess: () => setShowReopenDialog(false),
    })
  }

  const handleReview = () => {
    if (!reviewTarget) return
    reviewMutation.mutate({
      seasonId: season.id,
      subId: reviewTarget.sub.id,
      data: { status: reviewTarget.action, adminNotes: reviewNotes || undefined },
    }, {
      onSuccess: () => {
        setReviewTarget(null)
        setReviewNotes('')
      },
    })
  }

  const handleSaveEdit = () => {
    const data: Record<string, unknown> = { name: editName.trim() }
    if (editStartDate) data.startDate = editStartDate
    if (editEndDate) data.endDate = editEndDate
    if (editSubOpen) data.submissionOpen = editSubOpen
    if (editSubClose) data.submissionClose = editSubClose
    data.budgetCap = editBudgetCap ? Number(editBudgetCap) : null

    updateSeason.mutate({ id: season.id, data }, {
      onSuccess: () => setShowEditDrawer(false),
    })
  }

  const handleDelete = () => {
    deleteSeason.mutate(season.id, {
      onSuccess: () => setShowDeleteDialog(false),
    })
  }

  const openEditDrawer = () => {
    setEditName(season.name)
    setEditStartDate(season.startDate?.slice(0, 10) || '')
    setEditEndDate(season.endDate?.slice(0, 10) || '')
    setEditSubOpen(season.submissionOpen?.slice(0, 10) || '')
    setEditSubClose(season.submissionClose?.slice(0, 10) || '')
    setEditBudgetCap(season.budgetCap?.toString() || '')
    setShowEditDrawer(true)
  }

  const phaseInfo = PHASE_LABELS[season.phase] || PHASE_LABELS.SETUP
  const unresolvedConflicts = conflicts.filter((c) => !c.isResolved)

  // Build season action menu items
  const seasonMenuItems = [
    ...(prevPhase && season.phase !== 'CLOSED' ? [{
      label: `Go Back to ${PHASE_LABELS[prevPhase]?.label || prevPhase}`,
      icon: <ChevronLeft className="w-4 h-4" />,
      onClick: () => setShowGoBackDialog(true),
    }] : []),
    {
      label: 'Edit Season',
      icon: <Edit2 className="w-4 h-4" />,
      onClick: openEditDrawer,
    },
    ...(season.phase === 'CLOSED' ? [{
      label: 'Reopen Season',
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: () => setShowReopenDialog(true),
    }] : []),
    {
      label: 'Delete Season',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => setShowDeleteDialog(true),
      variant: 'danger' as const,
    },
  ]

  const reviewActionLabel: Record<string, string> = {
    APPROVED_IN_PRINCIPLE: 'Approve',
    NEEDS_REVISION: 'Request Revision',
    DECLINED: 'Decline',
  }

  const reviewActionVariant: Record<string, 'danger' | 'warning' | 'info'> = {
    APPROVED_IN_PRINCIPLE: 'info',
    NEEDS_REVISION: 'warning',
    DECLINED: 'danger',
  }

  return (
    <div className="space-y-6">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{season.name}</h3>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${phaseInfo.color}`}>{phaseInfo.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {nextPhase && (
            <button
              onClick={handleAdvancePhase}
              disabled={transitionPhase.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
            >
              Advance to {PHASE_LABELS[nextPhase]?.label || nextPhase}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <RowActionMenu items={seasonMenuItems} />
        </div>
      </div>

      {/* Phase Progress */}
      <div className="flex items-center gap-1">
        {PHASE_ORDER.map((phase, idx) => (
          <div key={phase} className={`flex-1 h-2 rounded-full ${idx <= currentPhaseIdx ? 'bg-gray-900' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ui-glass p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{submissions.length}</div>
          <div className="text-xs text-gray-500">Total Submissions</div>
        </div>
        <div className="ui-glass p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{submissions.filter((s) => s.submissionStatus === 'APPROVED' || s.submissionStatus === 'APPROVED_IN_PRINCIPLE').length}</div>
          <div className="text-xs text-gray-500">Approved</div>
        </div>
        <div className="ui-glass p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{submissions.filter((s) => s.submissionStatus === 'SUBMITTED').length}</div>
          <div className="text-xs text-gray-500">Awaiting Review</div>
        </div>
        <div className="ui-glass p-3 text-center">
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

      {/* Submissions Table */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Submissions</h4>
        {submissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No submissions yet</div>
        ) : (
          <div className="ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Submitted By</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Priority</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelectSubmission(sub)}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors text-left cursor-pointer"
                      >
                        {sub.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {sub.submittedBy.firstName} {sub.submittedBy.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {new Date(sub.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[sub.priority] || PRIORITY_COLORS.MEDIUM}`}>
                        {sub.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[sub.submissionStatus] || ''}`}>
                        {sub.submissionStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActionMenu items={getSubmissionActions(sub)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Confirm Dialog */}
      {reviewTarget && (
        <ConfirmDialog
          isOpen={!!reviewTarget}
          onClose={() => { setReviewTarget(null); setReviewNotes('') }}
          onConfirm={handleReview}
          title={`${reviewActionLabel[reviewTarget.action] || 'Review'} Submission`}
          message={`Are you sure you want to ${(reviewActionLabel[reviewTarget.action] || 'review').toLowerCase()} "${reviewTarget.sub.title}"?`}
          variant={reviewActionVariant[reviewTarget.action] || 'info'}
          confirmText={reviewActionLabel[reviewTarget.action] || 'Confirm'}
          isLoading={reviewMutation.isPending}
          loadingText="Saving..."
        >
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add review notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        </ConfirmDialog>
      )}

      {/* Go Back Confirm Dialog */}
      <ConfirmDialog
        isOpen={showGoBackDialog}
        onClose={() => setShowGoBackDialog(false)}
        onConfirm={handleGoBack}
        title="Go Back a Phase"
        message={`This will revert the season from "${phaseInfo.label}" back to "${PHASE_LABELS[prevPhase || '']?.label || prevPhase}". Any work done in the current phase will be preserved, but the phase status will change.`}
        variant="warning"
        confirmText={`Go Back to ${PHASE_LABELS[prevPhase || '']?.label || prevPhase}`}
        isLoading={transitionPhase.isPending}
        loadingText="Transitioning..."
      />

      {/* Reopen Confirm Dialog */}
      <ConfirmDialog
        isOpen={showReopenDialog}
        onClose={() => setShowReopenDialog(false)}
        onConfirm={handleReopen}
        title="Reopen Season"
        message={`This will move "${season.name}" from Closed back to Approving phase. You can then continue reviewing and publishing submissions.`}
        variant="info"
        confirmText="Reopen Season"
        isLoading={transitionPhase.isPending}
        loadingText="Reopening..."
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Planning Season"
        message={`This will permanently delete "${season.name}" and all its submissions, comments, blackout dates, and conflicts. This action cannot be undone.`}
        variant="danger"
        requireText={season.name}
        confirmText="Delete Season"
        isLoading={deleteSeason.isPending}
        loadingText="Deleting..."
      />

      {/* Edit Season Drawer */}
      <DetailDrawer
        isOpen={showEditDrawer}
        onClose={() => setShowEditDrawer(false)}
        title="Edit Season"
        width="md"
      >
        <div className="space-y-4 p-1">
          <FloatingInput
            label="Season Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingInput
              label="Start Date"
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
            />
            <FloatingInput
              label="End Date"
              type="date"
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingInput
              label="Submission Open"
              type="date"
              value={editSubOpen}
              onChange={(e) => setEditSubOpen(e.target.value)}
            />
            <FloatingInput
              label="Submission Close"
              type="date"
              value={editSubClose}
              onChange={(e) => setEditSubClose(e.target.value)}
            />
          </div>
          <FloatingInput
            label="Budget Cap"
            type="number"
            value={editBudgetCap}
            onChange={(e) => setEditBudgetCap(e.target.value)}
            placeholder="Optional"
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowEditDrawer(false)}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={updateSeason.isPending || !editName.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-50"
            >
              {updateSeason.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </DetailDrawer>
    </div>
  )

  // Helper to build per-row action menu items
  function getSubmissionActions(sub: PlanningSubmission) {
    const actions = []

    if (sub.submissionStatus === 'SUBMITTED') {
      actions.push(
        {
          label: 'Approve',
          icon: <CheckCircle className="w-4 h-4" />,
          onClick: () => { setReviewTarget({ sub, action: 'APPROVED_IN_PRINCIPLE' }); setReviewNotes('') },
        },
        {
          label: 'Request Revision',
          icon: <AlertTriangle className="w-4 h-4" />,
          onClick: () => { setReviewTarget({ sub, action: 'NEEDS_REVISION' }); setReviewNotes('') },
        },
        {
          label: 'Decline',
          icon: <XCircle className="w-4 h-4" />,
          onClick: () => { setReviewTarget({ sub, action: 'DECLINED' }); setReviewNotes('') },
          variant: 'danger' as const,
        },
      )
    }

    actions.push({
      label: 'View Details',
      icon: <Eye className="w-4 h-4" />,
      onClick: () => onSelectSubmission(sub),
    })

    return actions
  }
}
