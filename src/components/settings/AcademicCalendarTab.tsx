'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import type { SchoolOption, DeleteTarget, SubTab } from './academic-calendar/academic-calendar-types'
import { apiFetch } from './academic-calendar/academic-calendar-types'
import { AcademicYearSubTab } from './academic-calendar/AcademicYearSubTab'
import { BellScheduleSubTab } from './academic-calendar/BellScheduleSubTab'
import { SpecialDaysSubTab } from './academic-calendar/SpecialDaysSubTab'

// ── Component ──────────────────────────────────────────────────────────

export default function AcademicCalendarTab() {
  const queryClient = useQueryClient()

  // ── Use global school/campus selection from sidebar ──
  const { activeSchoolId, schools: activeSchools, isMultiSchool } = useActiveSchool()

  // Map to SchoolOption[] shape for sub-tab compatibility
  const schools: SchoolOption[] = activeSchools.map((s) => ({
    id: s.id,
    name: s.name,
    gradeLevel: '',
    color: '',
    campuses: [],
  }))

  const [subTab, setSubTab] = useState<SubTab>('academic-year')

  // ── Form visibility (lifted so parent can render action buttons) ──
  const [showYearForm, setShowYearForm] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showSpecialDayForm, setShowSpecialDayForm] = useState(false)

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const deleteYear = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/years/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })

  const deleteTerm = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/terms/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/bell-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bell-schedules'] }),
  })

  const deleteSpecialDayMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/academic/special-days/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-days'] }),
  })

  const isDeletePending =
    deleteYear.isPending ||
    deleteTerm.isPending ||
    deleteSchedule.isPending ||
    deleteSpecialDayMut.isPending

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

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'academic-year', label: 'Academic Year' },
    { key: 'bell-schedules', label: 'Bell Schedules' },
    { key: 'special-days', label: 'Special Days' },
  ]

  // Determine the action button for the active sub-tab
  const renderTabAction = () => {
    if (subTab === 'academic-year' && !showYearForm) {
      return (
        <button
          onClick={() => { setShowYearForm(true) }}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          + Add Year
        </button>
      )
    }
    if (subTab === 'bell-schedules' && !showScheduleForm) {
      return (
        <button
          onClick={() => { setShowScheduleForm(true) }}
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

        </div>

        {renderTabAction()}
        </div>
      </div>

      {/* ── Sub-tab content ────────────────────────────────────────── */}
      {subTab === 'academic-year' && (
        <AcademicYearSubTab
          schools={schools}
          activeSchoolId={activeSchoolId ?? ''}
          onRequestDelete={setDeleteTarget}
          showForm={showYearForm}
          onShowForm={setShowYearForm}
        />
      )}

      {subTab === 'bell-schedules' && (
        <BellScheduleSubTab
          schools={schools}
          activeSchoolId={activeSchoolId ?? ''}
          isMultiSchool={isMultiSchool}
          onRequestDelete={setDeleteTarget}
          showForm={showScheduleForm}
          onShowForm={setShowScheduleForm}
        />
      )}

      {subTab === 'special-days' && (
        <SpecialDaysSubTab
          schools={schools}
          activeSchoolId={activeSchoolId ?? ''}
          isMultiSchool={isMultiSchool}
          onRequestDelete={setDeleteTarget}
          showForm={showSpecialDayForm}
          onShowForm={setShowSpecialDayForm}
        />
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
