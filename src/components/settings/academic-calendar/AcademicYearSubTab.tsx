'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/Toast'
import { IllustrationCalendar } from '@/components/illustrations'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import type { SchoolOption, DeleteTarget, AcademicYear, Term } from './academic-calendar-types'
import { apiFetch, formatDate } from './academic-calendar-types'

// ── Props ─────────────────────────────────────────────────────────────

interface AcademicYearSubTabProps {
  schools: SchoolOption[]
  activeSchoolId: string
  onRequestDelete: (target: DeleteTarget) => void
  showForm: boolean
  onShowForm: (show: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────

export function AcademicYearSubTab({ schools, activeSchoolId, onRequestDelete, showForm, onShowForm }: AcademicYearSubTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Data ──
  const { data: years = [], isLoading: yearsLoading } = useQuery<AcademicYear[]>({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch('/api/academic/years'),
  })

  // ── Form State ──
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
  const [editingYear, setEditingYear] = useState<string | null>(null)
  const [showTermForm, setShowTermForm] = useState<string | null>(null)
  const [termForm, setTermForm] = useState({ name: '', startDate: '', endDate: '' })
  const [editingTerm, setEditingTerm] = useState<string | null>(null)

  // ── Mutations ──

  const createYear = useMutation({
    mutationFn: (data: typeof yearForm) => apiFetch('/api/academic/years', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-years'] }); onShowForm(false); setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false }) },
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

  // ── Helpers ──

  const startEditYear = (year: AcademicYear) => {
    setEditingYear(year.id)
    setYearForm({
      name: year.name,
      startDate: year.startDate.slice(0, 10),
      endDate: year.endDate.slice(0, 10),
      isCurrent: year.isCurrent,
    })
    onShowForm(true)
  }

  const cancelEditYear = () => {
    setEditingYear(null)
    onShowForm(false)
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

  return (
    <div className="space-y-3">

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-3">
              <Input
                type="text"
                placeholder="Year name (e.g., 2026-2027)"
                aria-label="Year name"
                value={yearForm.name}
                onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))}
                className="!h-auto flex-1 !border-0 !bg-transparent !px-0 !py-1 text-base font-semibold text-slate-900 placeholder:font-normal !outline-none !ring-0"
              />
              <Checkbox
                checked={yearForm.isCurrent}
                onChange={(e) => setYearForm((f) => ({ ...f, isCurrent: e.target.checked }))}
                label="Current Year"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition whitespace-nowrap select-none"
              />
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="flex-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Start Date</span>
              <span className="w-4" />
              <span className="flex-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">End Date</span>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="Start date" value={yearForm.startDate} onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))} className="flex-1 text-sm" />
              <span className="text-slate-300 text-xs">to</span>
              <Input type="date" aria-label="End date" value={yearForm.endDate} onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))} className="flex-1 text-sm" />
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
      ) : years.length === 0 && !showForm ? (
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
                    <button onClick={() => onRequestDelete({ kind: 'year', id: year.id, name: year.name })} className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Delete</button>
                  </div>
                </div>

                {/* Add term form (inline) */}
                {showTermForm === year.id && (
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input type="text" placeholder="Term name (e.g., Semester 1)" aria-label="Term name" value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" />
                      <Input type="date" aria-label="Term start" value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} className="text-sm" />
                      <Input type="date" aria-label="Term end" value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} className="text-sm" />
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
                            <Input type="text" size="sm" aria-label="Term name" value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} className="flex-1 min-w-0 text-sm" />
                            <Input type="date" size="sm" aria-label="Term start" value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} className="w-[130px] text-sm" />
                            <Input type="date" size="sm" aria-label="Term end" value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} className="w-[130px] text-sm" />
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
                              <button onClick={() => onRequestDelete({ kind: 'term', id: term.id, name: term.name })} className="px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer">Delete</button>
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
  )
}
