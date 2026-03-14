'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'
import type { UseCampusFilterReturn } from '@/lib/hooks/useCampusFilter'

interface CampusFilterChipProps {
  campusFilter: UseCampusFilterReturn
}

export default function CampusFilterChip({ campusFilter }: CampusFilterChipProps) {
  const {
    enabledCampuses,
    selectedCampusId,
    setSelectedCampusId,
    clearSelection,
    isMultiCampus,
    selectedCampusName,
  } = campusFilter

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // All options: "All Campuses" + each enabled campus
  const options = [
    { id: '', name: 'All Campuses' },
    ...enabledCampuses,
  ]

  const isActive = selectedCampusId !== ''

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Reset focus index when opening
  useEffect(() => {
    if (open) {
      const currentIndex = options.findIndex((o) => o.id === selectedCampusId)
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(i + 1, options.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            const opt = options[focusedIndex]
            if (opt.id === '') {
              clearSelection()
            } else {
              setSelectedCampusId(opt.id)
            }
            setOpen(false)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
      }
    },
    [open, focusedIndex, options, clearSelection, setSelectedCampusId]
  )

  // Scroll focused item into view
  useEffect(() => {
    if (open && listRef.current && focusedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[role="option"]')
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex, open])

  // Don't render if only one campus (no filter needed)
  // NOTE: This must come AFTER all hooks to satisfy React's Rules of Hooks
  if (!isMultiCampus) return null

  return (
    <div ref={containerRef} className="relative inline-flex" onKeyDown={handleKeyDown}>
      {/* Trigger chip */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          isActive
            ? 'bg-slate-900 text-white border border-slate-900'
            : 'text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Campus filter: ${selectedCampusName}`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[160px] truncate">{selectedCampusName}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full left-0 mt-1.5 z-50 min-w-[200px] ui-glass-dropdown p-1"
          >
            <ul ref={listRef} role="listbox" aria-label="Select campus" className="space-y-0.5">
              {options.map((opt, i) => {
                const isSelected = opt.id === selectedCampusId
                const isFocused = i === focusedIndex

                return (
                  <li
                    key={opt.id || '__all__'}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (opt.id === '') {
                        clearSelection()
                      } else {
                        setSelectedCampusId(opt.id)
                      }
                      setOpen(false)
                    }}
                    onMouseEnter={() => setFocusedIndex(i)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                      isFocused ? 'bg-slate-100' : ''
                    } ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{opt.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 flex-shrink-0" />}
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
