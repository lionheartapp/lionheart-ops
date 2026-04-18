'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/Toast'
import { IllustrationCalendar } from '@/components/illustrations'
import type { SchoolOption, DeleteTarget, BellSchedule, BellSchedulePeriod } from './academic-calendar-types'
import { apiFetch, WEEKDAYS, DAY_LABELS } from './academic-calendar-types'

// ── Props ─────────────────────────────────────────────────────────────

interface BellScheduleSubTabProps {
  schools: SchoolOption[]
  activeSchoolId: string
  isMultiSchool: boolean
  onRequestDelete: (target: DeleteTarget) => void
  showForm: boolean
  onShowForm: (show: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────

export function BellScheduleSubTab({ schools, activeSchoolId, isMultiSchool, onRequestDelete, showForm, onShowForm }: BellScheduleSubTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Data ──
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<BellSchedule[]>({
    queryKey: ['bell-schedules'],
    queryFn: () => apiFetch('/api/academic/bell-schedules'),
  })

  // ── Form State ──
  const [scheduleForm, setScheduleForm] = useState({ name: '', isDefault: false, daysOfWeek: [] as string[], schoolId: activeSchoolId as string, periods: [] as BellSchedulePeriod[] })
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)

  // ── Mutations ──

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

  const resetScheduleForm = useCallback(() => {
    setScheduleForm({ name: '', isDefault: false, daysOfWeek: [], schoolId: activeSchoolId, periods: [] })
    onShowForm(false)
    setEditingSchedule(null)
  }, [activeSchoolId, onShowForm])

  // ── Helpers ──

  const addPeriod = () => {
    setScheduleForm((prev) => {
      const lastPeriod = prev.periods[prev.periods.length - 1]
      const startTime = lastPeriod ? lastPeriod.endTime : '08:00'
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

  const startEditSchedule = (schedule: BellSchedule) => {
    setEditingSchedule(schedule.id)
    setScheduleForm({
      name: schedule.name,
      isDefault: schedule.isDefault,
      daysOfWeek: schedule.daysOfWeek || [],
      schoolId: schedule.school?.id || '',
      periods: schedule.periods.map((p) => ({ name: p.name, startTime: p.startTime, endTime: p.endTime, sortOrder: p.sortOrder })),
    })
    onShowForm(true)
  }

  const toggleDay = (day: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))
  }

  // Client-side school filtering
  const filteredSchedules = activeSchoolId
    ? schedules.filter((s) => s.school?.id === activeSchoolId)
    : schedules

  return (
    <div className="space-y-3">

      {showForm && (
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
      ) : filteredSchedules.length === 0 && !showForm ? (
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
                      onClick={() => onRequestDelete({ kind: 'schedule', id: schedule.id, name: schedule.name })}
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
  )
}
