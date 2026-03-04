'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface CalendarFilter {
  categoryIds: Set<string>
  campusIds: Set<string>
  schoolLevels: Set<string>
  sportIds: Set<string>
  teamLevels: Set<string>
}

interface CategoryChip {
  id: string
  name: string
  color: string
}

interface CampusChip {
  id: string
  name: string
}

interface Sport {
  id: string
  name: string
  color: string
}

interface CalendarFilterPopoverProps {
  isOpen: boolean
  onClose: () => void
  filter: CalendarFilter
  onFilterChange: (filter: CalendarFilter) => void
  categories: CategoryChip[]
  athleticsVisible: boolean
  campuses: CampusChip[]
  sports: Sport[]
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

const SCHOOL_LEVELS = [
  { value: 'ELEMENTARY', label: 'Elementary' },
  { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
  { value: 'HIGH_SCHOOL', label: 'High School' },
]

const TEAM_LEVELS = [
  { value: 'VARSITY', label: 'Varsity' },
  { value: 'JV', label: 'JV' },
  { value: 'FRESHMAN', label: 'Freshman' },
]

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export default function CalendarFilterPopover({
  isOpen,
  onClose,
  filter,
  onFilterChange,
  categories,
  athleticsVisible,
  campuses,
  sports,
  anchorRef,
}: CalendarFilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  // Position popover below anchor button
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 8,
      left: Math.max(8, rect.left - 100),
    })
  }, [isOpen, anchorRef])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [isOpen, onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activeCount =
    filter.categoryIds.size + filter.campusIds.size + filter.schoolLevels.size + filter.sportIds.size + filter.teamLevels.size

  const handleClear = () => {
    onFilterChange({
      categoryIds: new Set(),
      campusIds: new Set(),
      schoolLevels: new Set(),
      sportIds: new Set(),
      teamLevels: new Set(),
    })
  }

  const popover = (
    <div
      ref={popoverRef}
      className="fixed z-modal bg-white rounded-2xl shadow-xl border border-gray-200 w-80 max-h-[70vh] overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close filters"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = filter.categoryIds.has(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => onFilterChange({ ...filter, categoryIds: toggleInSet(filter.categoryIds, cat.id) })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={active ? { backgroundColor: cat.color } : undefined}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? '#fff' : cat.color }}
                  />
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Campus — athletics only */}
      {athleticsVisible && campuses.length > 1 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Campus</p>
          <div className="flex flex-wrap gap-2">
            {campuses.map(({ id, name }) => {
              const active = filter.campusIds.has(id)
              return (
                <button
                  key={id}
                  onClick={() => onFilterChange({ ...filter, campusIds: toggleInSet(filter.campusIds, id) })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* School Level — athletics only */}
      {athleticsVisible && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">School Level</p>
          <div className="flex flex-wrap gap-2">
            {SCHOOL_LEVELS.map(({ value, label }) => {
              const active = filter.schoolLevels.has(value)
              return (
                <button
                  key={value}
                  onClick={() => onFilterChange({ ...filter, schoolLevels: toggleInSet(filter.schoolLevels, value) })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sport — athletics only */}
      {athleticsVisible && sports.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sport</p>
          <div className="flex flex-wrap gap-2">
            {sports.map((sport) => {
              const active = filter.sportIds.has(sport.id)
              return (
                <button
                  key={sport.id}
                  onClick={() => onFilterChange({ ...filter, sportIds: toggleInSet(filter.sportIds, sport.id) })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={active ? { backgroundColor: sport.color } : undefined}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? '#fff' : sport.color }}
                  />
                  {sport.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Level — athletics only */}
      {athleticsVisible && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Team Level</p>
          <div className="flex flex-wrap gap-2">
            {TEAM_LEVELS.map(({ value, label }) => {
              const active = filter.teamLevels.has(value)
              return (
                <button
                  key={value}
                  onClick={() => onFilterChange({ ...filter, teamLevels: toggleInSet(filter.teamLevels, value) })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {activeCount > 0 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={handleClear}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Clear all filters ({activeCount})
          </button>
        </div>
      )}
    </div>
  )

  return createPortal(popover, document.body)
}
