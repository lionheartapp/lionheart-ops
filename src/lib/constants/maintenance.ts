/**
 * Shared maintenance module constants.
 * Single source of truth for status, priority, and category display values.
 */

// ─── Status ──────────────────────────────────────────────────────────────────

/** Badge classes for status (e.g., table cells, inline badges). */
export const STATUS_BADGE_COLORS: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  ON_HOLD: 'bg-red-100 text-red-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  QA: 'bg-pink-100 text-pink-700',
  QA_REVIEW: 'bg-pink-100 text-pink-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-400',
}

/** Dot + background + text classes for status (e.g., dashboard cards, activity feeds). */
export const STATUS_DOT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  BACKLOG: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600' },
  TODO: { dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_PROGRESS: { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  ON_HOLD: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700' },
  SCHEDULED: { dot: 'bg-violet-400', bg: 'bg-violet-50', text: 'text-violet-700' },
  QA: { dot: 'bg-pink-400', bg: 'bg-pink-50', text: 'text-pink-700' },
  QA_REVIEW: { dot: 'bg-pink-400', bg: 'bg-pink-50', text: 'text-pink-700' },
  DONE: { dot: 'bg-green-400', bg: 'bg-green-50', text: 'text-green-700' },
  CANCELLED: { dot: 'bg-slate-300', bg: 'bg-slate-50', text: 'text-slate-400' },
}

export const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  SCHEDULED: 'Scheduled',
  QA: 'QA Review',
  QA_REVIEW: 'QA Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

// ─── Priority ────────────────────────────────────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 font-semibold',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-slate-100 text-slate-500',
}

export const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

export const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

// ─── Category ────────────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  ELECTRICAL: '#f59e0b',
  PLUMBING: '#3b82f6',
  HVAC: '#06b6d4',
  STRUCTURAL: '#8b5cf6',
  CUSTODIAL_BIOHAZARD: '#ef4444',
  IT_AV: '#6366f1',
  GROUNDS: '#22c55e',
  OTHER: '#a8a49d',
}

export const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial',
  IT_AV: 'IT/AV',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

// ─── State Machine ───────────────────────────────────────────────────────────

/** Valid next-status transitions (client-side mirror of server state machine). */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  BACKLOG: ['TODO', 'SCHEDULED', 'CANCELLED'],
  TODO: ['IN_PROGRESS', 'BACKLOG', 'SCHEDULED', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['QA', 'DONE', 'ON_HOLD', 'TODO', 'CANCELLED'],
  ON_HOLD: ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  QA: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
}
