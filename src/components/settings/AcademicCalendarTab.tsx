'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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
  school?: { id: string; name: string } | null
  periods: BellSchedulePeriod[]
}

interface SpecialDay {
  id: string
  date: string
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
  { value: 'OTHER', label: 'Other', color: 'bg-gray-100 text-gray-700' },
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
  const [scheduleForm, setScheduleForm] = useState({ name: '', isDefault: false, periods: [] as BellSchedulePeriod[] })
  const [showSpecialDayForm, setShowSpecialDayForm] = useState(false)
  const [specialDayForm, setSpecialDayForm] = useState({ date: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true })
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)

  // ── Mutations ──

  const createYear = useMutation({
    mutationFn: (data: typeof yearForm) => apiFetch('/api/academic/years', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years'] }); setShowYearForm(false); setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false }) },
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

  const deleteTerm = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/terms/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })

  const createScheduleMut = useMutation({
    mutationFn: (data: typeof scheduleForm) => apiFetch('/api/academic/bell-schedules', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }); setShowScheduleForm(false); resetScheduleForm() },
  })

  const updateScheduleMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof scheduleForm }) =>
      apiFetch(`/api/academic/bell-schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }); setEditingSchedule(null); resetScheduleForm() },
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/bell-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }),
  })

  const createSpecialDayMut = useMutation({
    mutationFn: (data: typeof specialDayForm) => apiFetch('/api/academic/special-days', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['special-days'] }); setShowSpecialDayForm(false); setSpecialDayForm({ date: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true }) },
  })

  const deleteSpecialDayMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/special-days/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-days'] }),
  })

  const resetScheduleForm = useCallback(() => {
    setScheduleForm({ name: '', isDefault: false, periods: [] })
    setShowScheduleForm(false)
    setEditingSchedule(null)
  }, [])

  const addPeriod = () => {
    setScheduleForm((prev) => ({
      ...prev,
      periods: [...prev.periods, { name: '', startTime: '08:00', endTime: '08:50', sortOrder: prev.periods.length }],
    }))
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

  const startEditSchedule = (schedule: BellSchedule) => {
    setEditingSchedule(schedule.id)
    setScheduleForm({
      name: schedule.name,
      isDefault: schedule.isDefault,
      periods: schedule.periods.map((p) => ({ name: p.name, startTime: p.startTime, endTime: p.endTime, sortOrder: p.sortOrder })),
    })
    setShowScheduleForm(true)
  }

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'academic-year', label: 'Academic Year' },
    { key: 'bell-schedules', label: 'Bell Schedules' },
    { key: 'special-days', label: 'Special Days' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Academic Calendar</h2>
        <p className="text-sm text-gray-500 mt-1">Manage academic years, bell schedules, and special days</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              subTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Academic Year ────────────────────────────────────────── */}
      {subTab === 'academic-year' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Academic Years</h3>
            <button
              onClick={() => setShowYearForm(true)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              + Add Year
            </button>
          </div>

          {showYearForm && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="Name (e.g., 2025-2026)" aria-label="Year name" value={yearForm.name} onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                <input type="date" value={yearForm.startDate} onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                <input type="date" value={yearForm.endDate} onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={yearForm.isCurrent} onChange={(e) => setYearForm((f) => ({ ...f, isCurrent: e.target.checked }))} className="rounded" />
                Mark as current year
              </label>
              <div className="flex gap-2">
                <button onClick={() => createYear.mutate(yearForm)} disabled={createYear.isPending || !yearForm.name} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-full hover:bg-gray-800 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                  {createYear.isPending ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => setShowYearForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Cancel</button>
              </div>
            </div>
          )}

          {yearsLoading ? (
            <div className="animate-pulse space-y-4 p-6">
              <div className="h-8 w-48 bg-gray-200 rounded" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded-lg" />
                ))}
              </div>
            </div>
          ) : years.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No academic years configured</div>
          ) : (
            <div className="space-y-4">
              {years.map((year) => (
                <div key={year.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-white">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{year.name}</span>
                      {year.isCurrent && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Current</span>}
                      <span className="text-xs text-gray-500">{formatDate(year.startDate)} — {formatDate(year.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowTermForm(year.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">+ Term</button>
                      <button onClick={() => { if (confirm('Delete this academic year and all its terms?')) deleteYear.mutate(year.id) }} className="text-xs text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Delete</button>
                    </div>
                  </div>

                  {showTermForm === year.id && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="text" placeholder="Term name" aria-label="Term name" value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                        <input type="date" value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                        <input type="date" value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => createTermMut.mutate({ academicYearId: year.id, ...termForm })} disabled={createTermMut.isPending || !termForm.name} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-full hover:bg-gray-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                          {createTermMut.isPending ? 'Adding...' : 'Add Term'}
                        </button>
                        <button onClick={() => setShowTermForm(null)} className="text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Cancel</button>
                      </div>
                    </div>
                  )}

                  {year.terms.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {year.terms.map((term) => (
                        <div key={term.id} className="px-4 py-2.5 pl-8 flex items-center justify-between bg-white hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-sm font-medium text-gray-800">{term.name}</span>
                            <span className="text-xs text-gray-500">{formatDate(term.startDate)} — {formatDate(term.endDate)}</span>
                          </div>
                          <button onClick={() => { if (confirm('Delete this term?')) deleteTerm.mutate(term.id) }} className="text-xs text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bell Schedules ───────────────────────────────────────── */}
      {subTab === 'bell-schedules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Bell Schedules</h3>
            <button
              onClick={() => { resetScheduleForm(); setShowScheduleForm(true) }}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              + Add Schedule
            </button>
          </div>

          {showScheduleForm && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="Schedule name (e.g., Regular)" aria-label="Schedule name" value={scheduleForm.name} onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={scheduleForm.isDefault} onChange={(e) => setScheduleForm((f) => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                  Default schedule
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Periods</span>
                  <button onClick={addPeriod} className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">+ Add Period</button>
                </div>
                {scheduleForm.periods.map((period, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" placeholder="Period name" aria-label="Period name" value={period.name} onChange={(e) => updatePeriod(idx, 'name', e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                    <input type="time" aria-label="Start time" value={period.startTime} onChange={(e) => updatePeriod(idx, 'startTime', e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                    <span className="text-gray-400 text-sm">—</span>
                    <input type="time" aria-label="End time" value={period.endTime} onChange={(e) => updatePeriod(idx, 'endTime', e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                    <button onClick={() => removePeriod(idx)} className="text-red-400 hover:text-red-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">×</button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => editingSchedule ? updateScheduleMut.mutate({ id: editingSchedule, data: scheduleForm }) : createScheduleMut.mutate(scheduleForm)}
                  disabled={createScheduleMut.isPending || updateScheduleMut.isPending || !scheduleForm.name}
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-full hover:bg-gray-800 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  {(createScheduleMut.isPending || updateScheduleMut.isPending) ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}
                </button>
                <button onClick={resetScheduleForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Cancel</button>
              </div>
            </div>
          )}

          {schedulesLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No bell schedules configured</div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{schedule.name}</span>
                      {schedule.isDefault && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Default</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditSchedule(schedule)} className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Edit</button>
                      <button onClick={() => { if (confirm('Delete this bell schedule?')) deleteSchedule.mutate(schedule.id) }} className="text-xs text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Delete</button>
                    </div>
                  </div>
                  {schedule.periods.length > 0 && (
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {schedule.periods.map((p) => (
                          <span key={p.sortOrder} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-md text-xs text-gray-700">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-gray-400">{p.startTime}–{p.endTime}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Special Days ─────────────────────────────────────────── */}
      {subTab === 'special-days' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Special Days</h3>
            <button
              onClick={() => setShowSpecialDayForm(true)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              + Add Special Day
            </button>
          </div>

          {showSpecialDayForm && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="Name (e.g., Thanksgiving Break)" aria-label="Special day name" value={specialDayForm.name} onChange={(e) => setSpecialDayForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                <input type="date" aria-label="Special day date" value={specialDayForm.date} onChange={(e) => setSpecialDayForm((f) => ({ ...f, date: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10" />
                <select aria-label="Special day type" value={specialDayForm.specialDayType} onChange={(e) => setSpecialDayForm((f) => ({ ...f, specialDayType: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10">
                  {SPECIAL_DAY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={specialDayForm.isAllSchools} onChange={(e) => setSpecialDayForm((f) => ({ ...f, isAllSchools: e.target.checked }))} className="rounded" />
                Applies to all schools
              </label>
              <div className="flex gap-2">
                <button onClick={() => createSpecialDayMut.mutate(specialDayForm)} disabled={createSpecialDayMut.isPending || !specialDayForm.name || !specialDayForm.date} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-full hover:bg-gray-800 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                  {createSpecialDayMut.isPending ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => setShowSpecialDayForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Cancel</button>
              </div>
            </div>
          )}

          {specialDaysLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : specialDays.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No special days configured</div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {specialDays.map((day) => {
                const badge = getSpecialDayBadge(day.specialDayType)
                return (
                  <div key={day.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">{formatDate(day.date)}</span>
                      <span className="text-sm text-gray-900">{day.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>{badge.label}</span>
                      {day.isAllSchools && <span className="text-xs text-gray-400">All schools</span>}
                    </div>
                    <button onClick={() => { if (confirm('Delete this special day?')) deleteSpecialDayMut.mutate(day.id) }} className="text-xs text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Delete</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
