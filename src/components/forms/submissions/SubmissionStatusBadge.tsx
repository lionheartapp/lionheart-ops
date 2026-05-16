'use client'

import type { SubmissionStatus } from '@prisma/client'

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600' },
  SUBMITTED: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-700' },
  PENDING_APPROVAL: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700' },
}

export default function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.SUBMITTED

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  )
}
