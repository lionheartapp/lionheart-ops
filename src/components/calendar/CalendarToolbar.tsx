'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, SlidersHorizontal, Users, Sparkles } from 'lucide-react'
import type { ResolvedSearchFilter } from '@/lib/hooks/useSmartSearch'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import type { CalendarViewType } from '@/lib/hooks/useCalendar'
import { type CalendarFilter } from './CalendarFilterPopover'
import { EVENT_CREATE_OPTIONS, type EventCreateMode } from '@/components/events/CreateEventMenu'
import { SearchInput } from '@/components/ui/SearchInput'

interface CategoryChip {
  id: string
  name: string
  color: string
}

interface CampusChip {
  id: string
  name: string
}

interface SportChip {
  id: string
  name: string
  color: string
}

interface CalendarToolbarProps {
  currentDate: Date
  view: CalendarViewType
  onViewChange: (view: CalendarViewType) => void
  onNavigateBack: () => void
  onNavigateForward: () => void
  onToday: () => void
  onDateSelect?: (date: Date) => void
  onCreateEvent: () => void
  onPlanEvent?: () => void
  /**
   * Unified dispatcher for the 5 event-project create modes (ai / single /
   * recurring / multiday / template). Preferred over the per-mode handlers
   * below — keeps this dropdown in lock-step with the Events Hub menu and
   * the dashboard "+ Create" dropdown.
   */
  onCreateEventProject?: (mode: EventCreateMode) => void
  /** Whether the current user can see admin-only modes (recurring, template). */
  isAdmin?: boolean
  /** @deprecated Use `onCreateEventProject('single')` via onCreateEventProject. */
  onCreateSingleEvent?: () => void
  /** @deprecated Use `onCreateEventProject('multiday')` via onCreateEventProject. */
  onCreateMultiDayEvent?: () => void
  /** @deprecated Use `onCreateEventProject('recurring')` via onCreateEventProject. */
  onCreateRecurringEvent?: () => void
  /** @deprecated Use `onCreateEventProject('template')` via onCreateEventProject. */
  onCreateFromTemplate?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  /** AI-parsed search filter (null when not active) */
  aiFilter?: ResolvedSearchFilter | null
  /** Whether AI is currently processing the search query */
  aiSearchProcessing?: boolean
  /** Clear the AI filter */
  onClearAiFilter?: () => void
  categories: CategoryChip[]
  calendarFilter: CalendarFilter
  onCalendarFilterChange: (filter: CalendarFilter) => void
  athleticsVisible?: boolean
  userCampuses?: CampusChip[]
  visibleAthleticsCampusIds?: Set<string>
  onToggleAthleticsCampus?: (campusId: string) => void
  onToggleAllAthletics?: (enabled: boolean) => void
  campuses?: CampusChip[]
  sports?: SportChip[]
  /** List of external calendars the user has synced events from. */
  externalCalendars?: { id: string; name: string; provider: string }[]
  /** Whether the filter panel is currently open */
  filterPanelOpen?: boolean
  /** Toggle the filter panel open/closed */
  onToggleFilterPanel?: () => void
}

const viewLabels: Record<CalendarViewType, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
}

const viewShortcuts: Record<CalendarViewType, string> = {
  month: 'M',
  week: 'W',
  day: 'D',
  agenda: 'A',
}

function formatTitle(date: Date, view: CalendarViewType): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  if (view === 'month') {
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }
  if (view === 'week') {
    return `${months[date.getMonth()]}, ${date.getFullYear()}`
  }
  if (view === 'day') {
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatMobileTitle(date: Date, view: CalendarViewType): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (view === 'day') {
    return `${months[date.getMonth()]} ${date.getDate()}`
  }
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function getWeekDates(currentDate: Date): Date[] {
  const start = new Date(currentDate)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
}

const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function CalendarToolbar({
  currentDate,
  view,
  onViewChange,
  onNavigateBack,
  onNavigateForward,
  onToday,
  onDateSelect,
  onCreateEvent,
  onPlanEvent,
  onCreateEventProject,
  isAdmin = false,
  onCreateSingleEvent,
  onCreateMultiDayEvent,
  onCreateRecurringEvent,
  onCreateFromTemplate,
  searchQuery,
  onSearchChange,
  aiFilter,
  aiSearchProcessing = false,
  onClearAiFilter,
  categories,
  calendarFilter,
  onCalendarFilterChange,
  athleticsVisible = false,
  userCampuses = [],
  visibleAthleticsCampusIds = new Set<string>(),
  onToggleAthleticsCampus,
  onToggleAllAthletics,
  campuses = [],
  sports = [],
  externalCalendars = [],
  filterPanelOpen = false,
  onToggleFilterPanel,
}: CalendarToolbarProps) {
  const weekDates = getWeekDates(currentDate)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const { containerRef: viewTabsRef, setTabRef: setViewTabRef, indicatorStyle: viewIndicatorStyle } = useAnimatedTabIndicator(view)
  const { containerRef: mobileTabsRef, setTabRef: setMobileTabRef, indicatorStyle: mobileIndicatorStyle } = useAnimatedTabIndicator(view)

  const activeFilterCount =
    calendarFilter.categoryIds.size +
    calendarFilter.campusIds.size +
    calendarFilter.schoolLevels.size +
    calendarFilter.sportIds.size +
    calendarFilter.teamLevels.size

  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const createBtnRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!createDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (createBtnRef.current && !createBtnRef.current.contains(e.target as Node)) {
        setCreateDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [createDropdownOpen])

  return (
    <div className="pb-1 sm:pb-2">
      {/* Zone 1: Navigation bar */}
      <div className="flex items-center justify-between gap-2 pb-3 sm:pb-4 relative">
        {/* Left: Title */}
        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight min-w-0 truncate">
          <span className="hidden sm:inline">{formatTitle(currentDate, view)}</span>
          <span className="sm:hidden">{formatMobileTitle(currentDate, view)}</span>
        </h2>

        {/* Center: View switcher — desktop only, absolutely centered */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
          <div
            ref={viewTabsRef}
            className="relative flex bg-stone-100 rounded-full p-1"
            role="tablist"
            aria-label="Calendar view"
          >
            <motion.div
              className="absolute top-1 bottom-1 rounded-full bg-slate-900 shadow-sm pointer-events-none"
              style={{
                left: viewIndicatorStyle.left,
                width: viewIndicatorStyle.width,
                opacity: viewIndicatorStyle.opacity,
              }}
            />
            {(Object.keys(viewLabels) as CalendarViewType[]).map((v) => (
              <button
                key={v}
                ref={(el) => setViewTabRef(v, el)}
                role="tab"
                aria-selected={view === v}
                onClick={() => onViewChange(v)}
                title={`${viewLabels[v]} view (${viewShortcuts[v]})`}
                className={`relative z-10 px-5 py-1.5 text-sm font-semibold transition-colors duration-200 rounded-full cursor-pointer ${
                  view === v
                    ? 'text-white'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Nav pill + Create button */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Nav group in a single bordered pill */}
          <div className="flex items-center border border-stone-200 rounded-full overflow-hidden">
            <button
              onClick={onNavigateBack}
              className="px-2 sm:px-3 py-2 hover:bg-stone-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              aria-label="Previous period"
              title="Previous (←)"
            >
              <ChevronLeft className="w-4 h-4 text-stone-600" />
            </button>
            <button
              onClick={onToday}
              title="Go to today (T)"
              className="px-3 sm:px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-stone-50 transition-colors border-l border-r border-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
            >
              <span className="hidden sm:inline">Today</span>
              <span className="sm:hidden text-xs">Now</span>
            </button>
            <button
              onClick={onNavigateForward}
              className="px-2 sm:px-3 py-2 hover:bg-stone-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              aria-label="Next period"
              title="Next (→)"
            >
              <ChevronRight className="w-4 h-4 text-stone-600" />
            </button>
          </div>

          {/* Create button with dropdown */}
          <div ref={createBtnRef} className="relative hidden sm:flex items-center">
            <button
              onClick={() => setCreateDropdownOpen(o => !o)}
              className={`flex items-center gap-2 pl-3 sm:pl-4 pr-3 py-2 text-white text-sm font-semibold rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${createDropdownOpen ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-800'}`}
              aria-label="Create new event"
              aria-expanded={createDropdownOpen}
              title="Create (N)"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${createDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {createDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full pt-2 w-60 z-50"
                >
                  <div className="bg-white rounded-2xl shadow-xl border border-stone-200/80 overflow-hidden p-1.5 space-y-0.5">
                    <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide px-3 py-1.5">Meetings</p>
                    <button
                      onClick={() => { onCreateEvent(); setCreateDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 text-stone-700" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Schedule Meeting</p>
                        <p className="text-xs text-stone-500">Informal, added instantly</p>
                      </div>
                    </button>

                    <div className="h-px bg-stone-100 mx-3 my-1" />
                    <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide px-3 py-1.5">School Events</p>
                    {/* Render the 5 unified event-create modes. If a parent
                        passes the `onCreateEventProject` dispatcher we use it;
                        otherwise we fall back to the (deprecated) per-mode
                        handlers so older callers don't break. The AI option
                        was previously missing on the calendar — now it's in
                        parity with the Events Hub & dashboard. */}
                    {EVENT_CREATE_OPTIONS
                      .filter((o) => !o.adminOnly || isAdmin)
                      .map((opt) => {
                        const Icon = opt.icon
                        const legacyAction =
                          opt.mode === 'single' ? (onCreateSingleEvent ?? onPlanEvent)
                            : opt.mode === 'multiday' ? onCreateMultiDayEvent
                            : opt.mode === 'recurring' ? onCreateRecurringEvent
                            : opt.mode === 'template' ? onCreateFromTemplate
                            : undefined
                        const action = onCreateEventProject
                          ? () => onCreateEventProject(opt.mode)
                          : legacyAction
                        if (!action) return null
                        return (
                          <button
                            key={opt.mode}
                            onClick={() => { action(); setCreateDropdownOpen(false) }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon className="w-3.5 h-3.5 text-stone-500 group-hover:text-indigo-600 transition-colors" strokeWidth={1.75} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                              <p className="text-xs text-stone-500">{opt.description}</p>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Zone 2: Smart search + filters */}
      <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
        {/* Search input — full width, AI-aware */}
        <div className="relative flex-1 min-w-0">
          <SearchInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => {
              onSearchChange('')
              onClearAiFilter?.()
            }}
            placeholder="Search events"
            className={`rounded-full border-0 bg-stone-50 hover:bg-stone-100/80 ${
              aiFilter
                ? 'ring-2 ring-blue-200 bg-white shadow-sm'
                : aiSearchProcessing
                  ? 'ring-2 ring-blue-100 bg-white'
                  : 'focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:shadow-sm'
            }`}
          />
        </div>

        {/* Filter button — toggles the filter side panel */}
        <button
          ref={filterBtnRef}
          onClick={() => onToggleFilterPanel?.()}
          className={`relative flex items-center gap-1.5 px-4 py-3 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer ${
            filterPanelOpen
              ? 'bg-slate-900 text-white'
              : activeFilterCount > 0
                ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && !filterPanelOpen && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* AI search summary — appears below search bar when active */}
      <AnimatePresence>
        {aiFilter?.summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mt-2 px-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-[12px] font-medium text-blue-700">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span>{aiFilter.summary}</span>
                <button
                  onClick={() => {
                    onSearchChange('')
                    onClearAiFilter?.()
                  }}
                  className="ml-1 p-0.5 rounded-full hover:bg-blue-100 transition-colors cursor-pointer"
                  aria-label="Clear AI filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile view switcher */}
      <div
        ref={mobileTabsRef}
        className="relative flex sm:hidden bg-stone-100 rounded-full p-1 mt-4"
        role="tablist"
        aria-label="Calendar view"
      >
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-slate-900 shadow-sm pointer-events-none"
          style={{
            left: mobileIndicatorStyle.left,
            width: mobileIndicatorStyle.width,
            opacity: mobileIndicatorStyle.opacity,
          }}
        />
        {(Object.keys(viewLabels) as CalendarViewType[]).map((v) => (
          <button
            key={v}
            ref={(el) => setMobileTabRef(v, el)}
            role="tab"
            aria-selected={view === v}
            onClick={() => onViewChange(v)}
            className={`relative z-10 flex-1 text-center py-2 text-xs font-semibold transition-colors duration-200 rounded-full cursor-pointer ${
              view === v
                ? 'text-white'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {viewLabels[v]}
          </button>
        ))}
      </div>

      {/* Day column headers (week/day views only) */}
      {(view === 'week' || view === 'day') && (
        <div className="flex pt-3 sm:pt-4">
          <div className="hidden sm:block sm:w-14 flex-shrink-0" />
          {view === 'week' && (
            <div className="flex-1 grid grid-cols-7">
              {weekDates.map((date, i) => {
                const today = isToday(date)
                const selected = date.getFullYear() === currentDate.getFullYear() &&
                  date.getMonth() === currentDate.getMonth() &&
                  date.getDate() === currentDate.getDate()
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onDateSelect?.(date)}
                    className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-200 cursor-pointer hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label={`View ${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}`}
                    aria-current={today ? 'date' : undefined}
                  >
                    <span className={`text-[11px] sm:text-xs font-medium uppercase tracking-wider ${today || selected ? 'text-slate-900 font-semibold' : 'text-stone-400'}`}>
                      {dayNamesFull[date.getDay()].slice(0, 3)}
                    </span>
                    <span
                      className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                        today
                          ? 'bg-slate-900 text-white'
                          : selected
                            ? 'bg-stone-100 text-slate-900'
                          : 'text-slate-900'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {view === 'day' && (() => {
            const today = isToday(currentDate)
            return (
              <div className="flex flex-col items-center gap-0.5">
                <span className={`text-xs font-medium uppercase tracking-wider ${today ? 'text-slate-900 font-semibold' : 'text-stone-400'}`}>
                  {dayNamesFull[currentDate.getDay()].slice(0, 3)}
                </span>
                <span
                  className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                    today
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-900'
                  }`}
                >
                  {currentDate.getDate()}
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
