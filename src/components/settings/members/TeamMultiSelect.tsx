'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, X, Search } from 'lucide-react'
import type { TeamOption } from './types'

interface TeamMultiSelectProps {
  teams: TeamOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export default function TeamMultiSelect({
  teams,
  selectedIds,
  onChange,
  disabled,
}: TeamMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  )

  const selectedTeams = teams.filter((t) => selectedIds.includes(t.id))

  const toggleTeam = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    )
  }

  const removeTeam = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm focus:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-slate-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 ${
          selectedIds.length === 0 ? 'text-slate-400' : 'text-slate-900'
        }`}
        style={{ minHeight: '40px' }}
      >
        <span className="truncate">
          {selectedIds.length === 0
            ? 'Select teams…'
            : `${selectedIds.length} team${selectedIds.length !== 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {/* Selected team chips */}
      {selectedTeams.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTeams.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
            >
              {t.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTeam(t.id)}
                  className="hover:text-primary-900 transition"
                  style={{ minHeight: 'auto' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-modal mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                style={{ minHeight: 'auto' }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">No teams found</p>
            ) : (
              filtered.map((team) => {
                const isSelected = selectedIds.includes(team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 transition ${
                      isSelected ? 'text-primary-700 bg-primary-50/50' : 'text-slate-700'
                    }`}
                    style={{ minHeight: 'auto' }}
                  >
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span>{team.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
