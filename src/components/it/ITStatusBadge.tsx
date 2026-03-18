'use client'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  BACKLOG: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Backlog' },
  TODO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'To Do' },
  IN_PROGRESS: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In Progress' },
  ON_HOLD: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'On Hold' },
  DONE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
}

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  HARDWARE: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Hardware' },
  SOFTWARE: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Software' },
  ACCOUNT_PASSWORD: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Account / Password' },
  NETWORK: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Network' },
  DISPLAY_AV: { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Display / A/V' },
  OTHER: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Other' },
}

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.BACKLOG
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const c = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.OTHER
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export { STATUS_COLORS, PRIORITY_COLORS, TYPE_COLORS }
