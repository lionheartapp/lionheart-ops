'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/Toast'
import { IllustrationCalendar } from '@/components/illustrations'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { SchoolOption, DeleteTarget, SpecialDay } from './academic-calendar-types'
import { apiFetch, SPECIAL_DAY_TYPES, getSpecialDayBadge, formatDate } from './academic-calendar-types'

// ── Props ─────────────────────────────────────────────────────────────

interface SpecialDaysSubTabProps {
  schools: SchoolOption[]
  activeSchoolId: string
  isMultiSchool: boolean
  onRequestDelete: (target: DeleteTarget) => void
  showForm: boolean
  onShowForm: (show: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────

export function SpecialDaysSubTab({ schools, activeSchoolId, isMultiSchool, onRequestDelete, showForm, onShowForm }: SpecialDaysSubTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Data ──
  const { data: specialDays = [], isLoading: specialDaysLoading } = useQuery<SpecialDay[]>({
    queryKey: ['special-days'],
    queryFn: () => apiFetch('/api/academic/special-days'),
  })

  // ── Form State ──
  const [specialDayForm, setSpecialDayForm] = useState({ date: '', endDate: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true, schoolId: '' })
  const [specialDayMode, setSpecialDayMode] = useState<'single' | 'range'>('single')

  // ── Mutations ──

  const createSpecialDayMut = useMutation({
    mutationFn: (data: typeof specialDayForm) => {
      const payload = { ...data, endDate: data.endDate || null, schoolId: data.schoolId || undefined }
      return apiFetch('/api/academic/special-days', { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['special-days'] }); onShowForm(false); setSpecialDayForm({ date: '', endDate: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true, schoolId: '' }) },
    onError: (err: Error) => { toast(err.message || 'Failed to create special day', 'error') },
  })

  // Client-side school filtering
  const filteredSpecialDays = activeSchoolId
    ? specialDays.filter((d) => d.isAllSchools || d.school?.id === activeSchoolId)
    : specialDays

  return (
    <div className="space-y-3">

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <Input
                type="text"
                placeholder="Name (e.g., Thanksgiving Break, Teacher In-Service)"
                aria-label="Special day name"
                value={specialDayForm.name}
                onChange={(e) => setSpecialDayForm((f) => ({ ...f, name: e.target.value }))}
                className="!h-auto flex-1 !border-0 !bg-transparent !px-0 !py-1 text-base font-semibold text-slate-900 placeholder:font-normal !outline-none !ring-0"
              />
              <div className="w-44">
                <Select
                  size="sm"
                  value={specialDayForm.specialDayType}
                  onChange={(value) => setSpecialDayForm((f) => ({ ...f, specialDayType: value }))}
                  options={SPECIAL_DAY_TYPES}
                />
              </div>
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
                <Checkbox
                  checked={specialDayForm.isAllSchools}
                  onChange={(e) => setSpecialDayForm((f) => ({ ...f, isAllSchools: e.target.checked, schoolId: '' }))}
                  label="All schools"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition select-none"
                />
                {!specialDayForm.isAllSchools && isMultiSchool && (
                  <div className="w-44">
                    <Select
                      size="sm"
                      value={specialDayForm.schoolId}
                      onChange={(value) => setSpecialDayForm((f) => ({ ...f, schoolId: value }))}
                      placeholder="Select school..."
                      options={schools.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Date inputs */}
            {specialDayMode === 'single' ? (
              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Date</span>
                <Input type="date" aria-label="Date" value={specialDayForm.date} onChange={(e) => setSpecialDayForm((f) => ({ ...f, date: e.target.value }))} className="w-full max-w-xs text-sm" />
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Start</span>
                  <Input type="date" aria-label="Start date" value={specialDayForm.date} onChange={(e) => setSpecialDayForm((f) => ({ ...f, date: e.target.value }))} className="w-full text-sm" />
                </div>
                <span className="text-slate-300 text-xs pb-2.5">to</span>
                <div className="flex-1">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">End</span>
                  <Input type="date" aria-label="End date" value={specialDayForm.endDate} onChange={(e) => setSpecialDayForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full text-sm" />
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <button onClick={() => { onShowForm(false); setSpecialDayMode('single'); setSpecialDayForm({ date: '', endDate: '', name: '', specialDayType: 'HOLIDAY', isAllSchools: true, schoolId: '' }) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Cancel</button>
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
      ) : filteredSpecialDays.length === 0 && !showForm ? (
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
                    onClick={() => onRequestDelete({ kind: 'specialDay', id: day.id, name: day.name })}
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
  )
}
