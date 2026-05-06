'use client'

/**
 * SchoolSelector — Global "which campus am I viewing?" dropdown.
 *
 * Grouped by school entity: campuses are nested under their parent school
 * so admins can find the right campus quickly across a large org.
 *
 * - "All Schools" selects null (org-wide view).
 * - School headers are non-selectable group labels.
 * - Campuses are the selectable items.
 * - Keyboard nav: Up/Down moves focus, Enter/Space picks, Escape closes.
 *
 * Module-aware:
 *   - Detects the current path. When on a module page (e.g. /maintenance,
 *     /it, /athletics), the dropdown only lists schools where that module
 *     is enabled. Schools without the module are skipped.
 *   - The user's underlying global selection in localStorage is preserved
 *     across navigation — leaving the module page restores it.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, School } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'

interface CampusWithSchool {
  id: string
  name: string
  isActive: boolean
  school?: { id: string; name: string } | null
}

interface SchoolGroup {
  schoolId: string | null
  schoolName: string
  campuses: CampusWithSchool[]
}

interface FlatOption {
  type: 'all' | 'header' | 'campus'
  id: string | null
  label: string
  schoolName?: string
}

const ALL_SCHOOLS_LABEL = 'All Schools'

/**
 * Map a pathname to the moduleId whose enabled-schools list should restrict
 * the dropdown. Returns null when the path has no per-school module gate
 * (settings, dashboard, calendar, etc.).
 */
function getModuleForPath(pathname: string | null): string | null {
  if (!pathname) return null
  if (pathname.startsWith('/maintenance')) return 'maintenance'
  if (pathname.startsWith('/it')) return 'it-helpdesk'
  if (pathname.startsWith('/athletics')) return 'athletics'
  return null
}

export default function SchoolSelector(): JSX.Element | null {
  const pathname = usePathname()
  const restrictToModule = getModuleForPath(pathname)

  const {
    activeSchoolId,
    activeSchool,
    isMultiSchool,
    canSwitchSchools,
    isLoading,
    setActiveSchoolId,
  } = useActiveSchool()

  // Fetch full campus data with school relations for grouping
  const { data: rawCampuses } = useQuery(queryOptions.campuses())
  const { data: modulesData = [] } = useModules()

  // Compute the set of campus/school ids enabled for the current path's
  // module. When `restrictToModule` is null (non-module page), this is
  // null — meaning "no restriction".
  const enabledIdsForModule = useMemo<Set<string> | null>(() => {
    if (!restrictToModule) return null
    const modules = (modulesData ?? []) as ReadonlyArray<{
      moduleId: string
      schoolId?: string | null
      campusId?: string | null
    }>
    const ids = new Set<string>()
    for (const m of modules) {
      if (m.moduleId !== restrictToModule) continue
      const id = m.schoolId ?? m.campusId
      if (id) ids.add(id)
    }
    return ids
  }, [modulesData, restrictToModule])

  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Group campuses by school. When restricted to a module, drop campuses
  // that don't have it enabled — and drop empty school groups that result.
  const { flatOptions } = useMemo(() => {
    const campusList = (rawCampuses ?? []) as CampusWithSchool[]
    const active = campusList.filter(c => c.isActive)
    const visible = enabledIdsForModule
      ? active.filter((c) => enabledIdsForModule.has(c.id))
      : active

    // Build school groups
    const groupMap = new Map<string, SchoolGroup>()
    const ungrouped: CampusWithSchool[] = []

    for (const campus of visible) {
      if (campus.school) {
        const key = campus.school.id
        if (!groupMap.has(key)) {
          groupMap.set(key, { schoolId: key, schoolName: campus.school.name, campuses: [] })
        }
        groupMap.get(key)!.campuses.push(campus)
      } else {
        ungrouped.push(campus)
      }
    }

    const sortedGroups = Array.from(groupMap.values()).sort((a, b) => a.schoolName.localeCompare(b.schoolName))

    // Build flat list for keyboard nav (skip headers for selection)
    const flat: FlatOption[] = [{ type: 'all', id: null, label: ALL_SCHOOLS_LABEL }]

    for (const group of sortedGroups) {
      flat.push({ type: 'header', id: `header-${group.schoolId}`, label: group.schoolName })
      for (const campus of group.campuses) {
        flat.push({ type: 'campus', id: campus.id, label: campus.name, schoolName: group.schoolName })
      }
    }

    // Ungrouped campuses (no school assigned)
    for (const campus of ungrouped) {
      flat.push({ type: 'campus', id: campus.id, label: campus.name })
    }

    return { groups: sortedGroups, flatOptions: flat }
  }, [rawCampuses, enabledIdsForModule])

  // When restricted: count selectable campuses (excludes "All Schools" + headers)
  const visibleCampusCount = useMemo(
    () => flatOptions.filter((o) => o.type === 'campus').length,
    [flatOptions],
  )

  // The trigger label needs to reflect the EFFECTIVE state. If the user's
  // global selection isn't valid in this module, we say "All Schools" so
  // the page subtitle and the selector label agree.
  const effectiveActiveSchool =
    enabledIdsForModule && activeSchoolId && !enabledIdsForModule.has(activeSchoolId)
      ? null
      : activeSchool

  // Selectable options only (skip headers)
  const selectableIndices = useMemo(() =>
    flatOptions.map((o, i) => o.type !== 'header' ? i : -1).filter(i => i >= 0),
    [flatOptions]
  )

  // Reset focus index whenever we re-open
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1)
      return
    }
    // Highlight the effective selection (which may differ from the stored
    // selection on a module page where the stored school isn't enabled).
    const targetId = effectiveActiveSchool?.id ?? null
    const currentIdx = flatOptions.findIndex(o => o.id === targetId)
    setFocusedIndex(currentIdx >= 0 ? currentIdx : 0)
  }, [isOpen, effectiveActiveSchool, flatOptions])

  // Click-outside
  useEffect(() => {
    if (!isOpen) return
    const handle = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen])

  const selectAndClose = useCallback(
    (id: string | null) => {
      setActiveSchoolId(id)
      setIsOpen(false)
      requestAnimationFrame(() => buttonRef.current?.focus())
    },
    [setActiveSchoolId],
  )

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(true)
    }
  }

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      requestAnimationFrame(() => buttonRef.current?.focus())
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const currentSelectable = selectableIndices.indexOf(focusedIndex)
      const next = (currentSelectable + 1) % selectableIndices.length
      setFocusedIndex(selectableIndices[next])
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const currentSelectable = selectableIndices.indexOf(focusedIndex)
      const prev = (currentSelectable - 1 + selectableIndices.length) % selectableIndices.length
      setFocusedIndex(selectableIndices[prev])
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const opt = flatOptions[focusedIndex]
      if (opt && opt.type !== 'header') {
        selectAndClose(opt.id)
      }
    }
  }

  // Skeleton while initial load runs
  if (isLoading) {
    return (
      <div className="px-4 pb-3" aria-hidden="true">
        <div className="h-9 rounded-xl bg-white/30 border border-slate-200/40 animate-pulse" />
      </div>
    )
  }

  // Hide selector when there's nothing meaningful to choose. On a module
  // page with 0 or 1 enabled schools, the dropdown collapses; on a non-
  // module page, the legacy single-school behavior kicks in.
  const isMultiVisible = restrictToModule
    ? visibleCampusCount > 1
    : isMultiSchool
  if (!isMultiVisible) return null

  const triggerLabel = effectiveActiveSchool?.name ?? ALL_SCHOOLS_LABEL

  // Read-only for scoped users
  if (!canSwitchSchools) {
    return (
      <div className="px-4 pb-3">
        <div
          role="group"
          aria-label={`Active campus: ${triggerLabel} (pinned to your account)`}
          className="w-full h-9 rounded-xl border border-slate-200/60 bg-white/30 px-3 flex items-center gap-2 text-sm text-slate-700"
        >
          <School className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span className="flex-1 text-left truncate font-medium">{triggerLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-3" ref={containerRef}>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Active campus: ${triggerLabel}. Click to change.`}
          className={`w-full h-9 rounded-xl border px-3 flex items-center gap-2 text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
            isOpen
              ? 'bg-white/80 border-slate-400/60 text-slate-900 shadow-sm'
              : 'bg-white/40 border-slate-300/60 text-slate-700 hover:bg-white/60 hover:border-slate-400/50'
          }`}
        >
          <School className="w-4 h-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <span className="flex-1 text-left truncate font-medium">{triggerLabel}</span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="listbox"
              aria-label="Select a campus"
              tabIndex={-1}
              onKeyDown={handleMenuKeyDown}
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="absolute z-30 mt-1 left-0 right-0 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
            >
              <ul className="py-1 max-h-80 overflow-y-auto" role="presentation">
                {flatOptions.map((option, idx) => {
                  if (option.type === 'header') {
                    return (
                      <li key={option.id} role="presentation">
                        <div className="px-3 pt-3 pb-1.5 first:pt-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {option.label}
                          </p>
                        </div>
                      </li>
                    )
                  }

                  const selected = option.id === (effectiveActiveSchool?.id ?? null)
                  const focused = idx === focusedIndex
                  const isAll = option.type === 'all'

                  return (
                    <li key={option.id ?? 'all'} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectAndClose(option.id)}
                        onMouseEnter={() => setFocusedIndex(idx)}
                        className={`w-full flex items-center gap-2 text-sm text-left transition-colors cursor-pointer ${
                          isAll ? 'px-3 py-2 font-medium border-b border-slate-100' : 'pl-6 pr-3 py-1.5'
                        } ${
                          focused ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex-1 truncate">{option.label}</span>
                        {selected && (
                          <Check
                            className="w-4 h-4 flex-shrink-0 text-primary-500"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
