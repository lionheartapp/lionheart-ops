'use client'

import React from 'react'
import { Users, Check } from 'lucide-react'
import type { SchoolInfo } from './types'

type Props = {
  /** Currently selected school IDs. Empty array = shared with all schools. */
  selectedIds: string[]
  /** All schools in the current campus. */
  schools: SchoolInfo[]
  onChange: (nextIds: string[]) => void
  disabled?: boolean
  label?: string
}

/**
 * "Who uses this?" selector — lets the user mark a building/outdoor space as
 * shared with all schools OR scoped to one or more specific schools.
 *
 * - Shared: selectedIds = []
 * - Specific: selectedIds = [...schoolIds]
 *
 * Picking every school in the campus is equivalent to "Shared" and is
 * normalized to an empty array to keep the data model consistent.
 */
export default function SchoolAccessSelector({
  selectedIds,
  schools,
  onChange,
  disabled,
  label = 'Who uses this?',
}: Props) {
  const mode: 'shared' | 'specific' = selectedIds.length === 0 ? 'shared' : 'specific'
  const selectedSet = new Set(selectedIds)

  const setMode = (next: 'shared' | 'specific') => {
    if (next === 'shared') {
      onChange([])
    } else {
      // Switching to "specific" with nothing chosen yet → preselect all so
      // the user can deselect rather than starting from empty (which is
      // semantically identical to "shared").
      if (selectedIds.length === 0) {
        onChange(schools.map((s) => s.id))
      }
    }
  }

  const toggleSchool = (schoolId: string) => {
    const next = selectedSet.has(schoolId)
      ? selectedIds.filter((id) => id !== schoolId)
      : [...selectedIds, schoolId]

    // If user picked every school, collapse to "shared" (empty array)
    if (next.length === schools.length && schools.length > 0) {
      onChange([])
    } else {
      onChange(next)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">{label}</label>

      {/* Mode radio */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('shared')}
          disabled={disabled}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition ${
            mode === 'shared'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
          aria-pressed={mode === 'shared'}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">All schools</div>
            <div className={`text-xs ${mode === 'shared' ? 'text-white/70' : 'text-slate-400'}`}>
              Shared facility
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('specific')}
          disabled={disabled || schools.length === 0}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition ${
            mode === 'specific'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
          aria-pressed={mode === 'specific'}
        >
          <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Specific schools</div>
            <div className={`text-xs ${mode === 'specific' ? 'text-white/70' : 'text-slate-400'}`}>
              Pick one or more
            </div>
          </div>
        </button>
      </div>

      {/* School checkboxes — only shown when specific mode is active */}
      {mode === 'specific' && (
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {schools.length === 0 ? (
            <div className="p-3 text-sm text-slate-400 text-center">
              No schools in this campus yet. Add schools above first.
            </div>
          ) : (
            schools.map((school) => {
              const checked = selectedSet.has(school.id)
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => toggleSchool(school.id)}
                  disabled={disabled}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: school.color }}
                  />
                  <span className="text-sm font-medium text-slate-900 truncate">{school.name}</span>
                  <span className="ml-auto text-xs text-slate-400 uppercase tracking-wide">
                    {school.gradeLevel.replace('_', ' ').toLowerCase()}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
