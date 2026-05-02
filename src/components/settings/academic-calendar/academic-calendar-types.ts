// ── Shared Types ──────────────────────────────────────────────────────

export interface SchoolOption {
  id: string
  name: string
  gradeLevel: string
  color: string
  campuses: { id: string; name: string; gradeLevel: string }[]
}

export type DeleteTarget =
  | { kind: 'year'; id: string; name: string }
  | { kind: 'term'; id: string; name: string }
  | { kind: 'schedule'; id: string; name: string }
  | { kind: 'specialDay'; id: string; name: string }

export interface MarkingPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  sortOrder: number
}

export interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  sortOrder: number
  markingPeriods: MarkingPeriod[]
}

export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  school?: { id: string; name: string } | null
  terms: Term[]
}

export interface BellSchedulePeriod {
  id?: string
  name: string
  startTime: string
  endTime: string
  sortOrder: number
}

export interface BellSchedule {
  id: string
  name: string
  isDefault: boolean
  daysOfWeek: string[]
  school?: { id: string; name: string } | null
  periods: BellSchedulePeriod[]
}

export interface SpecialDay {
  id: string
  date: string
  endDate: string | null
  name: string
  specialDayType: string
  isAllSchools: boolean
  school?: { id: string; name: string } | null
  campus?: { id: string; name: string } | null
}

export type SubTab = 'academic-year' | 'bell-schedules' | 'special-days'

// ── Constants ─────────────────────────────────────────────────────────

export const WEEKDAYS = [
  { key: 'MON', label: 'M' },
  { key: 'TUE', label: 'T' },
  { key: 'WED', label: 'W' },
  { key: 'THU', label: 'T' },
  { key: 'FRI', label: 'F' },
  { key: 'SAT', label: 'S' },
  { key: 'SUN', label: 'S' },
] as const

export const DAY_LABELS: Record<string, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' }

export const SPECIAL_DAY_TYPES = [
  { value: 'HOLIDAY', label: 'Holiday', color: 'bg-red-100 text-red-700' },
  { value: 'CLOSURE', label: 'Closure', color: 'bg-red-100 text-red-700' },
  { value: 'EARLY_DISMISSAL', label: 'Early Dismissal', color: 'bg-orange-100 text-orange-700' },
  { value: 'LATE_START', label: 'Late Start', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PROFESSIONAL_DEVELOPMENT', label: 'Professional Development', color: 'bg-blue-100 text-blue-700' },
  { value: 'TESTING', label: 'Testing', color: 'bg-purple-100 text-purple-700' },
  { value: 'OTHER', label: 'Other', color: 'bg-slate-100 text-slate-700' },
]

// ── Helpers ───────────────────────────────────────────────────────────

export function getSpecialDayBadge(type: string) {
  return SPECIAL_DAY_TYPES.find((t) => t.value === type) || SPECIAL_DAY_TYPES[6]
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── API Helpers ────────────────────────────────────────────────────────

export function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options?.headers } })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || 'Request failed')
  return data.data
}
