'use client'

import { format } from 'date-fns'
import { CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import SubmissionStatusBadge from './SubmissionStatusBadge'
import { useUpdateSubmissionStatus, useDeleteSubmission, type FormSubmission } from '@/lib/hooks/useFormSubmissions'
import { useToast } from '@/components/Toast'
import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormSubmissionDetailProps {
  submission: FormSubmission | null
  formId: string
  /** Field definitions for rendering labels */
  fieldDefs: Array<{ key: string; label: string; type: string }>
  isOpen: boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormSubmissionDetail({
  submission,
  formId,
  fieldDefs,
  isOpen,
  onClose,
}: FormSubmissionDetailProps) {
  const { toast } = useToast()
  const updateStatus = useUpdateSubmissionStatus(formId)
  const deleteSub = useDeleteSubmission(formId)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!submission) return null

  const data = (submission.data ?? {}) as Record<string, unknown>
  const canApprove = ['SUBMITTED', 'PENDING_APPROVAL'].includes(submission.status)
  const canReject = ['SUBMITTED', 'PENDING_APPROVAL'].includes(submission.status)

  async function handleApprove() {
    try {
      await updateStatus.mutateAsync({ subId: submission!.id, status: 'APPROVED' })
      toast('Submission approved', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    }
  }

  async function handleReject() {
    try {
      await updateStatus.mutateAsync({ subId: submission!.id, status: 'REJECTED' })
      toast('Submission rejected', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteSub.mutateAsync(submission!.id)
      toast('Submission deleted', 'success')
      setShowDeleteConfirm(false)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error')
    }
  }

  const footer = (
    <div className="flex items-center gap-2">
      {canApprove && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={updateStatus.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors cursor-pointer"
        >
          {updateStatus.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          Approve
        </button>
      )}
      {canReject && (
        <button
          type="button"
          onClick={handleReject}
          disabled={updateStatus.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-60 transition-colors cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5" />
          Reject
        </button>
      )}
      <div className="flex-1" />
      {!showDeleteConfirm ? (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-600">Delete this submission?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteSub.isPending}
            className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60 cursor-pointer"
          >
            {deleteSub.isPending ? 'Deleting...' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Submission Detail"
      width="lg"
      footer={footer}
    >
      <div className="space-y-6">
        {/* Header info */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {submission.submitterName || 'Anonymous'}
            </p>
            {submission.submitterEmail && (
              <p className="text-xs text-slate-500">{submission.submitterEmail}</p>
            )}
          </div>
          <SubmissionStatusBadge status={submission.status} />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Submitted {format(new Date(submission.createdAt), 'MMM d, yyyy h:mm a')}</span>
          {submission.approvedAt && (
            <span>
              {submission.status === 'APPROVED' ? 'Approved' : 'Reviewed'}{' '}
              {format(new Date(submission.approvedAt), 'MMM d, yyyy')}
            </span>
          )}
        </div>

        {/* Field values */}
        <div className="space-y-3">
          {fieldDefs.map((field) => {
            const value = data[field.key]
            if (field.type === 'HEADER' || field.type === 'DIVIDER') return null

            return (
              <div key={field.key} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-xs font-medium text-slate-500 mb-0.5">{field.label}</p>
                <p className="text-sm text-slate-900">
                  {formatValue(value, field.type)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </DetailDrawer>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: unknown, fieldType: string): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (fieldType === 'DATE' && typeof value === 'string') {
    try {
      return format(new Date(value), 'MMM d, yyyy')
    } catch {
      return String(value)
    }
  }
  return String(value)
}
