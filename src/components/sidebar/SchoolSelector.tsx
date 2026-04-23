'use client'

/**
 * SchoolSelector — Global "which school am I looking at?" dropdown.
 *
 * Lives at the top of the Sidebar (below the org logo, above search) on
 * PowerSchool-style. Rendering contract:
 *
 *   - Hidden entirely when the org has <= 1 school (useActiveSchool
 *     reports `isMultiSchool: false`). Single-school orgs never see it.
 *   - While campuses are loading, renders a matched-height skeleton so the
 *     Sidebar doesn't shift layout on hydration.
 *   - The selection is a *viewpoint*, not a filter. Cross-school records
 *     still appear from consumer queries; consumers re-render from the
 *     selected school's perspective (home/away flips, "your team" label,
 *     etc.). See useActiveSchool.ts for the full contract.
 *
 * Interaction:
 *   - Click to toggle, click-outside to close.
 *   - Up/Down arrow to move focus, Enter/Space to pick, Escape to close.
 *   - "All Schools" is the first option and selects `null`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, School } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'

interface MenuOption {
  id: string | null
  label: string
}

const ALL_SCHOOLS_LABEL = 'All Schools'

export default function SchoolSelector(): JSX.Element | null {
  const {
    schools,
    activeSchoolId,
    activeSchool,
    isMultiSchool,
    canSwitchSchools,
    isLoading,
    setActiveSchoolId,
  } = useActiveSchool()

  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const options = useMemo<MenuOption[]>(() => {
    return [
      { id: null, label: ALL_SCHOOLS_LABEL },
      ...schools.map((s) => ({ id: s.id, label: s.name })),
    ]
  }, [schools])

  // Reset focus index whenever we re-open
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1)
      return
    }
    const idx = options.findIndex((o) => o.id === activeSchoolId)
    setFocusedIndex(idx >= 0 ? idx : 0)
  }, [isOpen, activeSchoolId, options])

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
      // Return focus to the trigger — standard menu UX.
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
      setFocusedIndex((prev) => (prev + 1) % options.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev - 1 + options.length) % options.length)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setFocusedIndex(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      setFocusedIndex(options.length - 1)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        selectAndClose(options[focusedIndex].id)
      }
    }
  }

  // Skeleton while initial load runs — keeps Sidebar height stable.
  if (isLoading) {
    return (
      <div className="px-4 pb-3" aria-hidden="true">
        <div className="h-9 rounded-xl bg-white/30 border border-slate-200/40 animate-pulse" />
      </div>
    )
  }

  // Single-school orgs: render nothing (not even a spacer — the search bar
  // already provides the gap below the logo).
  if (!isMultiSchool) return null

  const triggerLabel = activeSchool?.name ?? ALL_SCHOOLS_LABEL

  // Role-scoped users (member/viewer pinned to one school) see a read-only
  // badge instead of an interactive picker. The hook also enforces the pin
  // server-side permissions back this up — this is the UI half of that contract.
  if (!canSwitchSchools) {
    return (
      <div className="px-4 pb-3">
        <div
          role="group"
          aria-label={`Active school: ${triggerLabel} (pinned to your account)`}
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
          aria-label={`Active school: ${triggerLabel}. Click to change.`}
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
              aria-label="Select a school"
              tabIndex={-1}
              onKeyDown={handleMenuKeyDown}
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="absolute z-30 mt-1 left-0 right-0 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
            >
              <ul className="py-1 max-h-64 overflow-y-auto" role="presentation">
                {options.map((option, idx) => {
                  const selected = option.id === activeSchoolId
                  const focused = idx === focusedIndex
                  return (
                    <li key={option.id ?? 'all'} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectAndClose(option.id)}
                        onMouseEnter={() => setFocusedIndex(idx)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                          focused ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                        } ${option.id === null ? 'font-medium border-b border-slate-100' : ''}`}
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
