/**
 * Get form submissions that need approval from the given user.
 * @param {Array} formSubmissions - All submissions
 * @param {Array} forms - All forms
 * @param {string} userId - Current user's id
 * @returns {Array<{ submission, form }>} Pending approval items
 */
export function getPendingApprovalsForUser(formSubmissions, forms, userId) {
  if (!userId) return []
  const pending = formSubmissions.filter(
    (s) =>
      s.status === 'pending' &&
      s.approvals?.some(
        (a) => a.approverId === userId && a.approved == null
      )
  )
  const result = []
  for (const sub of pending) {
    const form = forms.find((f) => f.id === sub.formId)
    if (form?.approvalWorkflow?.approverIds?.includes(userId)) {
      result.push({ submission: sub, form })
    }
  }
  return result
}

/**
 * Build notifications list for TopBar (approvals + any future types).
 */
export function buildNotifications(formSubmissions, forms, userId) {
  const pending = getPendingApprovalsForUser(formSubmissions, forms, userId)
  return pending.map(({ submission, form }) => ({
    id: `approval-${submission.id}`,
    type: 'approval_pending',
    submissionId: submission.id,
    formId: form.id,
    title: `Form approval needed: "${form.title || 'Untitled'}"`,
    subtitle: `From ${submission.submittedBy || 'Someone'} • ${formatTimeAgo(submission.submittedAt)}`,
    time: submission.submittedAt,
    unread: true,
  }))
}

/**
 * Build a mailto: URL to notify approvers about a pending form submission.
 */
export function buildApproversMailtoUrl(approverIds, users, form, submission) {
  const emails = approverIds
    .map((id) => users.find((u) => u.id === id)?.email)
    .filter(Boolean)
  if (emails.length === 0) return null
  const formTitle = form?.title || 'Untitled form'
  const subject = encodeURIComponent(`Form approval needed: ${formTitle}`)
  const body = encodeURIComponent(
    `Hi,\n\nA form submission for "${formTitle}" is awaiting your approval.\n\nSubmitted by: ${submission?.submittedBy || 'Unknown'}\nSubmitted at: ${submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}\n\nPlease sign in to the dashboard to review and approve.`
  )
  return `mailto:${emails.join(',')}?subject=${subject}&body=${body}`
}

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
