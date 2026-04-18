'use client'

import { CONDITION_COLORS } from './deployment-types'

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export function ItemStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600',
    PROCESSED: 'bg-green-100 text-green-700',
    SKIPPED: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONDITION_COLORS[condition] || 'bg-slate-100 text-slate-600'}`}>
      {condition}
    </span>
  )
}
