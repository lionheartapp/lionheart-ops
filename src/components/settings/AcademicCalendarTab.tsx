'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Building2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { IllustrationCalendar } from '@/components/illustrations'
import ConfirmDialog from '@/components/ConfirmDialog'

interface SchoolOption {
  id: string
  name: string
  gradeLevel: string
  color: string
}

// ── Delete confirmation state ──────────────────────────────────────────

type DeleteTarget =
  | { kind: 'year'; id: string; name: string }
  | { kind: 'term'; id: string; name: string }
  | { kind: 'schedule'; id: string; name: string }
  | { kind: 'specialDay'; id: string; name: string }

// ── Types ──────────────────────────────────────────────────────────────

interface MarkingPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  sortOrder: number
}

interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  sortOrder: number
  markingPeriods: MarkingPeriod[]
}

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  school?: { id: string; name: string } | null
  terms: Term[]
}

interface BellSchedulePeriod {
  id?: string
  name: string
  startTime: string
  endTime: string
  sortOrder: number
}

interface BellSchedule {
  id: string
  name: string
  isDefault: boolean
  daysOfWeek: string[]
  school?: { id: string; name: string } | null
  periods: BellSchedulePeriod[]
}

const WEEKDAYS = [
  { key: 'MON', label: 'M' },
  { key: 'TUE', label: 'T' },
  { key: 'WED', label: 'W' },
  { key: 'THU', label: 'T' },
  { key: 'FRI', label: 'F' },
  { key: 'SAT', label: 'S' },
  { key: 'SUN', label: 'S' },
] as const

const DAY_LABELS: Record<string, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' }

interface SpecialDay {
  id: string
  date: string
  endDate: string | null
  name: string
  specialDayType: string
  isAllSchools: boolean
  school?: { id: string; name: string } | null
  campus?: { id: string; name: string } | null
}

type SubTab = 'academic-year' | 'bell-schedules' | 'special-days'

const SPECIAL_DAY_TYPES = [
  { value: 'HOLIDAY', label: 'Holiday', color: 'bg-red-100 text-red-700' },
  { value: 'CLOSURE', label: 'Closure', color: 'bg-red-100 text-red-700' },
  { value: 'EARLY_DISMISSAL', label: 'Early Dismissal', color: 'bg-orange-100 text-orange-700' },
  { value: 'LATE_START', label: 'Late Start', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PROFESSIONAL_DEVELOPMENT', label: 'Professional Development', color: 'bg-blue-100 text-blue-700' },
  { value: 'TESTING', label: 'Testing', color: 'bg-purple-100 text-purple-700' },
  { value: 'OTHER', label: 'Other', color: 'bg-slate-100 text-slate-700' },
]

function getSpecialDayBadge(type: string) {
  return SPECIAL_DAY_TYPES.find((t) => t.value === type) || SPECIAL_DAY_TYPES[6]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── API Helpers ────────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options?.headers } })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || 'Request failed')
  return data.data
}

// ── Component ──────────────────────────────────────────────────────────

export default function AcademicCalendarTab() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Schools for multi-campus ──
  const { data: schools = [] } = useQuery<SchoolOption[]>({
    queryKey: ['schools-list'],
    queryFn: () => apiFetch('/api/settings/schools'),
    staleTime: 5 * 60 * 1000,
  })
  const [activeSchoolId, setActiveSchoolId] = useState<string>('') // '' = all schools
  const isMultiSchool = schools.length > 1
  const [subTab, setSubTab] = useState<SubTab>('academic-year')

  // ── Academic Years ──
  const { data: years = [], isLoading: yearsLoading } = useQuery<AcademicYear[]>({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch('/api/academic/years'),
  })

  // ── Bell Schedules ──
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<BellSchedule[]>({
    queryKey: ['bell-schedules'],
    queryFn: () => apiFetch('/api/academic/bell-schedules'),
  })

  // ── Special Days ──
  const { data: specialDays = [], isLoading: specialDaysLoading } = useQuery<SpecialDay[]>({
    queryKey: ['special-days'],
    queryFn: () => apiFetch('/api/academic/special-days'),
  })

  // ── Form State ──
  const [showYearForm, setShowYearForm] = useState(false)
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
  const [showTermForm, setShowTermForm] = useState<string | null>(null)
  const [termForm, setTermForm] = useState({ name: '', startDate: '', endDate: '' })
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ name: '', isDefault: false, daysOfWeek: [] as string[], schoolId: '' as string, periods: [] as BellSchedulePeriod[] })
  const [showSpecialDayForm, setShowSpecialDayForm] = useState(false)
  const [specialDayForm, setSpecialDayForm] = useState({ date: '', endDate: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true, schoolId: '' })
  const [specialDayMode, setSpecialDayMode] = useState<'single' | 'range'>('single')
  const [editingYear, setEditingYear] = useState<string | null>(null)
  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  // ── Mutations ──

  const createYear = useMutation({
    mutationFn: (data: typeof yearForm) => apiFetch('/api/academic/years', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years'] }); setShowYearForm(false); setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false }) },
  })

  const updateYear = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof yearForm }) =>
      apiFetch(`/api/academic/years/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years'] }); setEditingYear(null); setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false }) },
    onError: (err: Error) => { toast(err.message || 'Failed to update year', 'error') },
  })

  const deleteYear = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/years/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })

  const createTermMut = useMutation({
    mutationFn: (data: { academicYearId: string; name: string; startDate: string; endDate: string }) =>
      apiFetch('/api/academic/terms', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years'] }); setShowTermForm(null); setTermForm({ name: '', startDate: '', endDate: '' }) },
  })

  const updateTermMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof termForm }) =>
      apiFetch(`/api/academic/terms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years'] }); setEditingTerm(null); setTermForm({ name: '', startDate: '', endDate: '' }) },
    onError: (err: Error) => { toast(err.message || 'Failed to update term', 'error') },
  })

  const deleteTerm = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/terms/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })

  const createScheduleMut = useMutation({
    mutationFn: (data: typeof scheduleForm) => apiFetch('/api/academic/bell-schedules', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }); resetScheduleForm() },
    onError: (err: Error) => { toast(err.message || 'Failed to create schedule', 'error') },
  })

  const updateScheduleMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof scheduleForm }) =>
      apiFetch(`/api/academic/bell-schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }); resetScheduleForm() },
    onError: (err: Error) => { toast(err.message || 'Failed to update schedule', 'error') },
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/bell-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }),
  })

  const createSpecialDayMut = useMutation({
    mutationFn: (data: typeof specialDayForm) => {
      const payload = { ...data, endDate: data.endDate || null, schoolId: data.schoolId || undefined }
      return apiFetch('/api/academic/special-days', { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['special-days'] }); setShowSpecialDayForm(false); setSpecialDayForm({ date: '', endDate: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true, schoolId: '' }) },
    onError: (err: Error) => { toast(err.message || 'Failed to create special day', 'error') },
  })

  const deleteSpecialDayMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/special-days/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-days'] }),
  })

  const resetScheduleForm = useCallback(() => {
    setScheduleForm({ name: '', isDefault: false, daysOfWeek: [], schoolId: activeSchoolId, periods: [] })
    setShowScheduleForm(false)
    setEditingSchedule(null)
  }, [activeSchoolId])

  const addPeriod = () => {
    setScheduleForm((prev) => {
      const lastPeriod = prev.periods[prev.periods.length - 1]
      const startTime = lastPeriod ? lastPeriod.endTime : '08:00'
      // Default to 50 minutes after start
      const [h, m] = startTime.split(':').map(Number)
      const endMin = h * 60 + m + 50
      const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
      return {
        ...prev,
        periods: [...prev.periods, { name: '', startTime, endTime, sortOrder: prev.periods.length }],
      }
    })
  }

  const updatePeriod = (idx: number, field: string, value: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      periods: prev.periods.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }))
  }

  const removePeriod = (idx: number) => {
    setScheduleForm((prev) => ({
      ...prev,
      periods: prev.periods.filter((_, i) => i !== idx),
    }))
  }

  const startEditYear = (year: AcademicYear) => {
    setEditingYear(year.id)
    setYearForm({
      name: year.name,
      startDate: year.startDate.slice(0, 10),
      endDate: year.endDate.slice(0, 10),
      isCurrent: year.isCurrent,
    })
    setShowYearForm(true)
  }

  const cancelEditYear = () => {
    setEditingYear(null)
    setShowYearForm(false)
    setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false })
  }

  const startEditTerm = (term: Term) => {
    setEditingTerm(term.id)
    setTermForm({
      name: term.name,
      startDate: term.startDate.slice(0, 10),
      endDate: term.endDate.slice(0, 10),
    })
  }

  const cancelEditTerm = () => {
    setEditingTerm(null)
    setTermForm({ name: '', startDate: '', endDate: '' })
  }

  const startEditSchedule = (schedule: BellSchedule) => {
    setEditingSchedule(schedule.id)
    setScheduleForm({
      name: schedule.name,
      isDefault: schedule.isDefault,
      daysOfWeek: schedule.daysOfWeek || [],
      schoolId: schedule.school?.id || '',
      periods: schedule.periods.map((p) => ({ name: p.name, startTime: p.startTime, endTime: p.endTime, sortOrder: p.sortOrder })),
    })
    setShowScheduleForm(true)
  }

  const toggleDay = (day: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))
  }

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'academic-year', label: 'Academic Year' },
    { key: 'bell-schedules', label: 'Bell Schedules' },
    { key: 'special-days', label: 'Special Days' },
  ]

  // ── Delete confirmation helpers ──────────────────────────────────────

  const deleteDialogCopy = (target: DeleteTarget | null): { title: string; message: string } => {
    if (!target) return { title: '', message: '' }
    switch (target.kind) {
      case 'year':
        return {
          title: 'Delete academic year?',
          message: `This will permanently delete "${target.name}" and all of its terms and marking periods. This cannot be undone.`,
        }
      case 'term':
        return {
          title: 'Delete term?',
          message: `This will permanently delete the term "${target.name}" and all of its marking periods. This cannot be undone.`,
        }
      case 'schedule':
        return {
          title: 'Delete bell schedule?',
          message: `This will permanently delete the bell schedule "${target.name}". This cannot be undone.`,
        }
      case 'specialDay':
        return {
          title: 'Delete special day?',
          message: `This will permanently delete the special day "${target.name}". This cannot be undone.`,
        }
    }
  }

  const isDeletePending =
    deleteYear.isPending ||
    deleteTerm.isPending ||
    deleteSchedule.isPending ||
    deleteSpecialDayMut.isPending

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    const onSettled = () => setDeleteTarget(null)
    switch (deleteTarget.kind) {
      case 'year':
        deleteYear.mutate(deleteTarget.id, { onSettled })
        return
      case 'term':
        deleteTerm.mutate(deleteTarget.id, { onSettled })
        return
      case 'schedule':
        deleteSchedule.mutate(deleteTarget.id, { onSettled })
        return
      case 'specialDay':
        deleteSpecialDayMut.mutate(deleteTarget.id, { onSettled })
        return
    }
  }

  const dialogCopy = deleteDialogCopy(deleteTarget)

  // Client-side school filtering
  const filteredSchedules = activeSchoolId
    ? schedules.filter((s) => s.school?.id === activeSchoolId)
    : schedules
  const filteredSpecialDays = activeSchoolId
    ? specialDays.filter((d) => d.isAllSchools || d.school?.id === activeSchoolId)
    : specialDays

  // Determine the action button for the active sub-tab
  const renderTabAction = () => {
    if (subTab === 'academic-year' && !showYearForm) {
      return (
        <button
          onClick={() => { cancelEditYear(); setShowYearForm(true) }}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          + Add Year
        </button>
      )
    }
    if (subTab === 'bell-schedules' && !showScheduleForm) {
      return (
        <button
          onClick={() => { resetScheduleForm(); setShowScheduleForm(true) }}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          + Add Schedule
        </button>
      )
    }
    if (subTab === 'special-days' && !showSpecialDayForm) {
      return (
        <button
          onClick={() => setShowSpecialDayForm(true)}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          + Add Special Day
        </button>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Section header + tabs in one card */}
      <div className="ui-glass p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Academic Calendar</h3>
            <p className="text-sm text-slate-500 mt-0.5">Manage academic years, bell schedules, and special days</p>
          </div>
        </div>

        {/* Tab bar + action button */}
        <div className="mt-5 pt-5 border-t border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
              {subTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSubTab(t.key)}
                  className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    subTab === t.key ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {subTab === t.key && (
                    <motion.div
                      layoutId="academicCalendarPill"
                      className="absolute inset-0 rounded-full bg-slate-900"
                      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>

          {isMultiSchool && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveSchoolId('')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                    activeSchoolId === '' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  All Schools
                </button>
                {schools.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSchoolId(s.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                      activeSchoolId === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {renderTabAction()}
        </div>
      </div>

      {/* ── Academic Year ────────────────────────────────────────── */}
      {subTab === 'academic-year' && (
        <div className="space-y-3">

          {showYearForm && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Year name (e.g., 2026-2027)"
                    aria-label="Year name"
                    value={yearForm.name}
                    onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 px-0 py-1 bg-transparent border-none text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                  />
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition whitespace-nowrap select-none">
                    <input
                      type="checkbox"
                      checked={yearForm.isCurrent}
                      onChange={(e) => setYearForm((f) => ({ ...f, isCurrent: e.target.checked }))}
                      className="rounded text-green-600 border-slate-300 focus:ring-green-500 focus:ring-offset-0"
                    />
                    Current Year
                  </label>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="flex-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Start Date</span>
                  <span className="w-4" />
                  <span className="flex-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">End Date</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" aria-label="Start date" value={yearForm.startDate} onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                  <span className="text-slate-300 text-xs">to</span>
                  <input type="date" aria-label="End date" value={yearForm.endDate} onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button onClick={cancelEditYear} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Cancel</button>
                <button
                  onClick={() => editingYear ? updateYear.mutate({ id: editingYear, data: yearForm }) : createYear.mutate(yearForm)}
                  disabled={createYear.isPending || updateYear.isPending || !yearForm.name || !yearForm.startDate || !yearForm.endDate}
                  className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  {(createYear.isPending || updateYear.isPending) ? 'Saving...' : editingYear ? 'Save Changes' : 'Create Year'}
                </button>
              </div>
            </div>
          )}

          {yearsLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : years.length === 0 && !showYearForm ? (
            <div className="text-center py-12">
              <IllustrationCalendar className="w-40 h-32 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No academic years configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {years.map((year) => {
                if (editingYear === year.id) return null
                return (
                  <div key={year.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {/* Year header */}
                    <div className="group/year flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{year.name}</span>
                        {year.isCurrent && <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[11px] font-semibold rounded-full uppercase tracking-wide ring-1 ring-green-200">Current</span>}
                        <span className="text-xs text-slate-400 tabular-nums font-mono">{formatDate(year.startDate)} — {formatDate(year.endDate)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/year:opacity-100 focus-within:opacity-100 transition">
                        <button onClick={() => startEditYear(year)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Edit</button>
                        <button onClick={() => setShowTermForm(year.id)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">+ Term</button>
                        <button onClick={() => setDeleteTarget({ kind: 'year', id: year.id, name: year.name })} className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Delete</button>
                      </div>
                    </div>

                    {/* Add term form (inline) */}
                    {showTermForm === year.id && (
                      <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input type="text" placeholder="Term name (e.g., Semester 1)" aria-label="Term name" value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                          <input type="date" aria-label="Term start" value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                          <input type="date" aria-label="Term end" value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => createTermMut.mutate({ academicYearId: year.id, ...termForm })} disabled={createTermMut.isPending || !termForm.name} className="px-4 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                            {createTermMut.isPending ? 'Adding...' : 'Add Term'}
                          </button>
                          <button onClick={() => setShowTermForm(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Terms list */}
                    {year.terms.length > 0 && (
                      <div className="px-5 pb-4">
                        <div className="grid gap-1.5">
                          {year.terms.map((term) => (
                            editingTerm === term.id ? (
                              <div key={term.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                <input type="text" aria-label="Term name" value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-sm bg-white focus:border-slate-400 focus:outline-none" />
                                <input type="date" aria-label="Term start" value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} className="w-[130px] px-2 py-1 border border-slate-200 rounded-md text-sm bg-white focus:border-slate-400 focus:outline-none" />
                                <input type="date" aria-label="Term end" value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} className="w-[130px] px-2 py-1 border border-slate-200 rounded-md text-sm bg-white focus:border-slate-400 focus:outline-none" />
                                <button onClick={() => updateTermMut.mutate({ id: term.id, data: termForm })} disabled={updateTermMut.isPending} className="px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                                  {updateTermMut.isPending ? '...' : 'Save'}
                                </button>
                                <button onClick={cancelEditTerm} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                              </div>
                            ) : (
                              <div key={term.id} className="group/term flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-slate-700 flex-1">{term.name}</span>
                                <span className="text-xs text-slate-400 tabular-nums font-mono">{formatDate(term.startDate)} — {formatDate(term.endDate)}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover/term:opacity-100 transition">
                                  <button onClick={() => startEditTerm(term)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer">Edit</button>
                                  <button onClick={() => setDeleteTarget({ kind: 'term', id: term.id, name: term.name })} className="px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer">Delete</button>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Bell Schedules ───────────────────────────────────────── */}
      {subTab === 'bell-schedules' && (
        <div className="space-y-3">

          {showScheduleForm && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Form header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Schedule name (e.g., Regular, Block Day, Assembly)"
                    aria-label="Schedule name"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 px-0 py-1 bg-transparent border-none text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                  />
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition whitespace-nowrap select-none">
                    <input
                      type="checkbox"
                      checked={scheduleForm.isDefault}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, isDefault: e.target.checked }))}
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    Default
                  </label>
                </div>

                {/* School picker + Day-of-week picker */}
                <div className="flex items-center gap-4 flex-wrap">
                  {isMultiSchool && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">School</span>
                      <select
                        value={scheduleForm.schoolId}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, schoolId: e.target.value }))}
                        className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                      >
                        <option value="">All Schools</option>
                        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Days</span>
                  {WEEKDAYS.map((day) => {
                    const active = scheduleForm.daysOfWeek.includes(day.key)
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`w-8 h-8 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          active
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                        }`}
                        title={DAY_LABELS[day.key]}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              </div>

              {/* Periods */}
              <div className="px-5 py-4 space-y-2">
                {scheduleForm.periods.length > 0 && (
                  <div className="flex items-center gap-2 px-1 mb-1">
                    <span className="flex-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Period</span>
                    <span className="w-[130px] text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">Start</span>
                    <span className="w-4" />
                    <span className="w-[130px] text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">End</span>
                    <span className="w-7" />
                  </div>
                )}

                {scheduleForm.periods.map((period, idx) => (
                  <div key={idx} className="flex items-center gap-2 group/row">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-medium flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Period name"
                        aria-label="Period name"
                        value={period.name}
                        onChange={(e) => updatePeriod(idx, 'name', e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition"
                      />
                    </div>
                    <input
                      type="time"
                      aria-label="Start time"
                      value={period.startTime}
                      onChange={(e) => updatePeriod(idx, 'startTime', e.target.value)}
                      className="w-[130px] px-3 py-2 border border-slate-200 rounded-lg text-sm text-center tabular-nums focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition"
                    />
                    <span className="text-slate-300 text-xs">to</span>
                    <input
                      type="time"
                      aria-label="End time"
                      value={period.endTime}
                      onChange={(e) => updatePeriod(idx, 'endTime', e.target.value)}
                      className="w-[130px] px-3 py-2 border border-slate-200 rounded-lg text-sm text-center tabular-nums focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition"
                    />
                    <button
                      onClick={() => removePeriod(idx)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover/row:opacity-100 focus:opacity-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label="Remove period"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}

                <button
                  onClick={addPeriod}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Period
                </button>
              </div>

              {/* Form footer */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  onClick={resetScheduleForm}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => editingSchedule ? updateScheduleMut.mutate({ id: editingSchedule, data: scheduleForm }) : createScheduleMut.mutate(scheduleForm)}
                  disabled={createScheduleMut.isPending || updateScheduleMut.isPending || !scheduleForm.name}
                  className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  {(createScheduleMut.isPending || updateScheduleMut.isPending) ? 'Saving...' : editingSchedule ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </div>
          )}

          {schedulesLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : filteredSchedules.length === 0 && !showScheduleForm ? (
            <div className="text-center py-12">
              <IllustrationCalendar className="w-40 h-32 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No bell schedules configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSchedules.map((schedule) => {
                // Hide this card when it's being edited
                if (editingSchedule === schedule.id) return null
                return (
                  <div key={schedule.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="group/sched flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{schedule.name}</span>
                        {schedule.isDefault && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-semibold rounded-full uppercase tracking-wide ring-1 ring-blue-200">Default</span>}
                        {!activeSchoolId && schedule.school && <span className="text-xs text-slate-400">{schedule.school.name}</span>}
                        {schedule.daysOfWeek?.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            {WEEKDAYS.map((day) => {
                              const active = schedule.daysOfWeek.includes(day.key)
                              return (
                                <span
                                  key={day.key}
                                  className={`w-6 h-6 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                                    active
                                      ? 'bg-slate-800 text-white'
                                      : 'bg-slate-100 text-slate-300'
                                  }`}
                                  title={DAY_LABELS[day.key]}
                                >
                                  {day.label}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/sched:opacity-100 focus-within:opacity-100 transition">
                        <button
                          onClick={() => startEditSchedule(schedule)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ kind: 'schedule', id: schedule.id, name: schedule.name })}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {schedule.periods.length > 0 && (
                      <div className="px-5 pb-4">
                        <div className="grid gap-1.5">
                          {schedule.periods.map((p, idx) => (
                            <div
                              key={p.sortOrder}
                              className="flex items-center gap-3 px-3 py-2 bg-slate-50/80 rounded-lg"
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-sm font-medium text-slate-700 flex-1">{p.name}</span>
                              <span className="text-xs text-slate-400 tabular-nums font-mono tracking-wide">
                                {p.startTime} – {p.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Special Days ─────────────────────────────────────────── */}
      {subTab === 'special-days' && (
        <div className="space-y-3">

          {showSpecialDayForm && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Name (e.g., Thanksgiving Break, Teacher In-Service)"
                    aria-label="Special day name"
                    value={specialDayForm.name}
                    onChange={(e) => setSpecialDayForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 px-0 py-1 bg-transparent border-none text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                  />
                  <select
                    aria-label="Special day type"
                    value={specialDayForm.specialDayType}
                    onChange={(e) => setSpecialDayForm((f) => ({ ...f, specialDayType: e.target.value }))}
                    className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                  >
                    {SPECIAL_DAY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Single Day / Date Range toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => { setSpecialDayMode('single'); setSpecialDayForm((f) => ({ ...f, endDate: '' })) }}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                        specialDayMode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecialDayMode('range')}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                        specialDayMode === 'range' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Date Range
                    </button>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition select-none">
                      <input
                        type="checkbox"
                        checked={specialDayForm.isAllSchools}
                        onChange={(e) => setSpecialDayForm((f) => ({ ...f, isAllSchools: e.target.checked, schoolId: '' }))}
                        className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      All schools
                    </label>
                    {!specialDayForm.isAllSchools && isMultiSchool && (
                      <select
                        value={specialDayForm.schoolId}
                        onChange={(e) => setSpecialDayForm((f) => ({ ...f, schoolId: e.target.value }))}
                        className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                      >
                        <option value="">Select school...</option>
                        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                {/* Date inputs */}
                {specialDayMode === 'single' ? (
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Date</span>
                    <input type="date" aria-label="Date" value={specialDayForm.date} onChange={(e) => setSpecialDayForm((f) => ({ ...f, date: e.target.value }))} className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Start</span>
                      <input type="date" aria-label="Start date" value={specialDayForm.date} onChange={(e) => setSpecialDayForm((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                    </div>
                    <span className="text-slate-300 text-xs pb-2.5">to</span>
                    <div className="flex-1">
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">End</span>
                      <input type="date" aria-label="End date" value={specialDayForm.endDate} onChange={(e) => setSpecialDayForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 transition" />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button onClick={() => { setShowSpecialDayForm(false); setSpecialDayMode('single'); setSpecialDayForm({ date: '', endDate: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true, schoolId: '' }) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Cancel</button>
                <button
                  onClick={() => createSpecialDayMut.mutate(specialDayForm)}
                  disabled={createSpecialDayMut.isPending || !specialDayForm.name || !specialDayForm.date}
                  className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  {createSpecialDayMut.isPending ? 'Creating...' : 'Create Special Day'}
                </button>
              </div>
            </div>
          )}

          {specialDaysLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : filteredSpecialDays.length === 0 && !showSpecialDayForm ? (
            <div className="text-center py-12">
              <IllustrationCalendar className="w-40 h-32 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No special days configured</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredSpecialDays.map((day) => {
                  const badge = getSpecialDayBadge(day.specialDayType)
                  const isRange = day.endDate && day.endDate !== day.date
                  return (
                    <div key={day.id} className="group/day flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-700 tabular-nums">
                          {formatDate(day.date)}{isRange ? ` — ${formatDate(day.endDate!)}` : ''}
                        </span>
                        <span className="text-sm font-medium text-slate-900">{day.name}</span>
                        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full uppercase tracking-wide ${badge.color}`}>{badge.label}</span>
                        {day.isAllSchools ? (
                          <span className="text-[11px] text-slate-400">All schools</span>
                        ) : day.school ? (
                          <span className="text-[11px] text-slate-400">{day.school.name}</span>
                        ) : null}
                      </div>
                      <button
                        onClick={() => setDeleteTarget({ kind: 'specialDay', id: day.id, name: day.name })}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer opacity-0 group-hover/day:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => { if (!isDeletePending) setDeleteTarget(null) }}
        onConfirm={handleDeleteConfirm}
        title={dialogCopy.title}
        message={dialogCopy.message}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeletePending}
        loadingText="Deleting..."
      />
    </div>
  )
}
