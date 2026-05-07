'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { CalendarFilter } from './CalendarFilterPopover'

// ── Shared types ────────────────────────────────────────────────────────

interface CampusItem {
  id: string
  name: string
}

interface CategoryChip {
  id: string
  name: string
  color: string
}

interface SportItem {
  id: string
  name: string
  color: string
}

interface CalendarItem {
  id: string
  name: string
  color: string
  calendarType: string
  isActive: boolean
}

interface ExternalCalendarItem {
  id: string
  name: string
  provider: string
}

// ── Constants ───────────────────────────────────────────────────────────

const SCHOOL_LEVELS = [
  { value: 'ELEMENTARY', label: 'Elementary' },
  { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
  { value: 'HIGH_SCHOOL', label: 'High School' },
]

const TEAM_LEVELS = [
  { value: 'VARSITY', label: 'Varsity' },
  { value: 'VARSITY_B', label: 'Varsity B' },
  { value: 'JUNIOR_VARSITY', label: 'JV' },
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'FROSH_SOPH', label: 'Frosh-Soph' },
  { value: 'C_TEAM', label: 'C-Team' },
  { value: 'CLUB', label: 'Club' },
  { value: 'INTRAMURAL', label: 'Intramural' },
  { value: 'UNIFIED', label: 'Unified' },
]

// ── Helpers ─────────────────────────────────────────────────────────────

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// ── Custom checkbox component ───────────────────────────────────────────

function FilterCheckbox({
  checked,
  color = '#3B82F6',
}: {
  checked: boolean
  color?: string
  onChange?: () => void
}) {
  return (
    <div
      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors duration-150"
      style={checked ? { backgroundColor: color, borderColor: color } : { borderColor: '#cbd5e1' }}
      role="checkbox"
      aria-checked={checked}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

// ── Collapsible section ─────────────────────────────────────────────────

function FilterSection({
  label,
  defaultOpen = true,
  children,
  count,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
  count?: number
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
      >
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 text-[10px] font-semibold text-slate-400">({count})</span>
          )}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Props ───────────────────────────────────────────────────────────────

interface CalendarFilterPanelProps {
  isOpen: boolean
  onClose: () => void
  filter: CalendarFilter
  onFilterChange: (filter: CalendarFilter) => void

  // My Calendars
  calendars: CalendarItem[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (calendarId: string) => void

  // Categories
  categories: CategoryChip[]

  // External Calendars
  externalCalendars: ExternalCalendarItem[]

  // Athletics
  athleticsVisible: boolean
  userCampuses: CampusItem[]
  visibleAthleticsCampusIds: Set<string>
  onToggleAthleticsCampus: (campusId: string) => void
  onToggleAllAthletics: (enabled: boolean) => void
  sports: SportItem[]
}

// ── Main component ──────────────────────────────────────────────────────

export default function CalendarFilterPanel({
  isOpen,
  onClose,
  filter,
  onFilterChange,
  calendars,
  visibleCalendarIds,
  onToggleCalendar,
  categories,
  externalCalendars,
  athleticsVisible,
  userCampuses,
  visibleAthleticsCampusIds,
  onToggleAthleticsCampus,
  onToggleAllAthletics,
  sports,
}: CalendarFilterPanelProps) {
  const activeFilterCount =
    filter.categoryIds.size +
    filter.campusIds.size +
    filter.schoolIds.size +
    filter.schoolLevels.size +
    filter.sportIds.size +
    filter.teamLevels.size +
    (filter.hiddenExternalCalendarIds?.size || 0)

  const handleClear = useCallback(() => {
    onFilterChange({
      categoryIds: new Set(),
      campusIds: new Set(),
      schoolIds: new Set(),
      schoolLevels: new Set(),
      sportIds: new Set(),
      teamLevels: new Set(),
      hiddenExternalCalendarIds: new Set(),
    })
  }, [onFilterChange])

  // Group external calendars by provider
  const groupedExternalCalendars = externalCalendars.reduce<Record<string, ExternalCalendarItem[]>>(
    (acc, cal) => {
      const key = cal.provider === 'google_calendar' ? 'Google Calendar'
        : cal.provider === 'microsoft_calendar' ? 'Microsoft Calendar'
        : 'External Calendars'
      if (!acc[key]) acc[key] = []
      acc[key].push(cal)
      return acc
    },
    {},
  )

  // Desktop panel
  const panelContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={handleClear}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors duration-150"
            >
              Clear ({activeFilterCount})
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 transition-colors duration-150"
            aria-label="Close filters"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* School Calendars (non-personal) */}
        {calendars.filter((c) => c.isActive && c.calendarType !== 'PERSONAL').length > 0 && (
          <FilterSection label="School Calendars">
            <div className="space-y-0.5">
              {calendars
                .filter((c) => c.isActive && c.calendarType !== 'PERSONAL')
                .map((cal) => {
                  const isVisible = visibleCalendarIds.has(cal.id)
                  return (
                    <button
                      key={cal.id}
                      type="button"
                      onClick={() => onToggleCalendar(cal.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer text-left group"
                    >
                      <FilterCheckbox
                        checked={isVisible}
                        color={cal.color}
                        onChange={() => onToggleCalendar(cal.id)}
                      />
                      <span className={`text-sm truncate ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                        {cal.name}
                      </span>
                    </button>
                  )
                })}
            </div>
          </FilterSection>
        )}

        {/* My Calendars (personal) */}
        {calendars.filter((c) => c.isActive && c.calendarType === 'PERSONAL').length > 0 && (
          <FilterSection label="My Calendars">
            <div className="space-y-0.5">
              {calendars
                .filter((c) => c.isActive && c.calendarType === 'PERSONAL')
                .map((cal) => {
                  const isVisible = visibleCalendarIds.has(cal.id)
                  return (
                    <button
                      key={cal.id}
                      type="button"
                      onClick={() => onToggleCalendar(cal.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer text-left group"
                    >
                      <FilterCheckbox
                        checked={isVisible}
                        color={cal.color}
                        onChange={() => onToggleCalendar(cal.id)}
                      />
                      <span className={`text-sm truncate ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                        {cal.name}
                      </span>
                    </button>
                  )
                })}
            </div>
          </FilterSection>
        )}

        {/* External Calendars — grouped by provider */}
        {Object.entries(groupedExternalCalendars).map(([providerLabel, cals]) => (
          <FilterSection key={providerLabel} label={providerLabel}>
            <div className="space-y-0.5">
              {cals.map((cal) => {
                const isHidden = filter.hiddenExternalCalendarIds?.has(cal.id)
                const isVisible = !isHidden
                return (
                  <button
                    key={cal.id}
                    type="button"
                    onClick={() => onFilterChange({
                      ...filter,
                      hiddenExternalCalendarIds: toggleInSet(filter.hiddenExternalCalendarIds || new Set(), cal.id),
                    })}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer text-left group"
                  >
                    <FilterCheckbox
                      checked={isVisible}
                      color="#3B82F6"
                      onChange={() => onFilterChange({
                        ...filter,
                        hiddenExternalCalendarIds: toggleInSet(filter.hiddenExternalCalendarIds || new Set(), cal.id),
                      })}
                    />
                    <span className={`text-sm truncate ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                      {cal.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </FilterSection>
        ))}

        {/* Categories */}
        {categories.length > 0 && (
          <FilterSection label="Categories" count={filter.categoryIds.size}>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const active = filter.categoryIds.has(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => onFilterChange({ ...filter, categoryIds: toggleInSet(filter.categoryIds, cat.id) })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          </FilterSection>
        )}

        {/* Athletics */}
        {userCampuses.length > 0 && (
          <FilterSection label="Athletics" defaultOpen={athleticsVisible}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Show athletic events</span>
                <button
                  onClick={() => onToggleAllAthletics(!athleticsVisible)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors duration-150 cursor-pointer ${
                    athleticsVisible
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {athleticsVisible ? 'On' : 'Off'}
                </button>
              </div>

              {athleticsVisible && (
                <div className="space-y-0.5">
                  {userCampuses.map(({ id, name }) => {
                    const active = visibleAthleticsCampusIds.has(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onToggleAthleticsCampus(id)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer text-left group"
                      >
                        <FilterCheckbox
                          checked={active}
                          color="#F97316"
                          onChange={() => onToggleAthleticsCampus(id)}
                        />
                        <span className={`text-sm truncate ${active ? 'text-slate-700' : 'text-slate-400'}`}>
                          {name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {!athleticsVisible && (
                <p className="text-xs text-slate-400">Toggle on to see athletic events</p>
              )}
            </div>
          </FilterSection>
        )}

        {/* School Level — athletics only */}
        {athleticsVisible && (
          <FilterSection label="School Level" count={filter.schoolLevels.size} defaultOpen={filter.schoolLevels.size > 0}>
            <div className="flex flex-wrap gap-1.5">
              {SCHOOL_LEVELS.map(({ value, label }) => {
                const active = filter.schoolLevels.has(value)
                return (
                  <button
                    key={value}
                    onClick={() => onFilterChange({ ...filter, schoolLevels: toggleInSet(filter.schoolLevels, value) })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </FilterSection>
        )}

        {/* Sport — athletics only */}
        {athleticsVisible && sports.length > 0 && (
          <FilterSection label="Sport" count={filter.sportIds.size} defaultOpen={filter.sportIds.size > 0}>
            <div className="flex flex-wrap gap-1.5">
              {sports.map((sport) => {
                const active = filter.sportIds.has(sport.id)
                return (
                  <button
                    key={sport.id}
                    onClick={() => onFilterChange({ ...filter, sportIds: toggleInSet(filter.sportIds, sport.id) })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          </FilterSection>
        )}

        {/* Team Level — athletics only */}
        {athleticsVisible && (
          <FilterSection label="Team Level" count={filter.teamLevels.size} defaultOpen={filter.teamLevels.size > 0}>
            <div className="flex flex-wrap gap-1.5">
              {TEAM_LEVELS.map(({ value, label }) => {
                const active = filter.teamLevels.has(value)
                return (
                  <button
                    key={value}
                    onClick={() => onFilterChange({ ...filter, teamLevels: toggleInSet(filter.teamLevels, value) })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </FilterSection>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: side panel that pushes content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="hidden sm:flex flex-col flex-shrink-0 border-r border-slate-200 overflow-hidden self-stretch"
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: full-width overlay with backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="sm:hidden fixed inset-y-0 left-0 w-full max-w-sm bg-white z-50 shadow-xl"
            >
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
