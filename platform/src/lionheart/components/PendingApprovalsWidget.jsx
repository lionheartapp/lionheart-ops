import { useMemo } from 'react'
import { FileCheck, ChevronRight } from 'lucide-react'
import { getPendingApprovalsForUser } from '../utils/pendingApprovals'

function formatTimeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default function PendingApprovalsWidget({
  formSubmissions,
  forms,
  currentUser,
  onNavigateToFormResponses,
}) {
  const pending = useMemo(
    () => getPendingApprovalsForUser(formSubmissions, forms, currentUser?.id),
    [formSubmissions, forms, currentUser?.id]
  )

  if (pending.length === 0) return null

  return (
    <section>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        Pending approvals
      </h3>
      <div className="glass-card divide-y divide-zinc-200 dark:divide-zinc-700">
        {pending.map(({ submission, form }) => (
          <button
            key={submission.id}
            type="button"
            onClick={() => onNavigateToFormResponses?.(form.id)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {form.title || 'Untitled form'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  From {submission.submittedBy || 'Unknown'} • {formatTimeAgo(submission.submittedAt)}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
          </button>
        ))}
      </div>
    </section>
  )
}
