'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Search, X, SlidersHorizontal, Users, Calendar } from 'lucide-react'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import type { CalendarViewType } from '@/lib/hooks/useCalendar'
import CalendarFilterPopover, { type CalendarFilter } from './CalendarFilterPopover'

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
  onCreateEvent: () => void
  onPlanEvent?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
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
}

const viewLabels: Record<CalendarViewType, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
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
  onCreateEvent,
  onPlanEvent,
  searchQuery,
  onSearchChange,
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
}: CalendarToolbarProps) {
  const weekDates = getWeekDates(currentDate)
  const [filterOpen, setFilterOpen] = useState(false)
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
    <div className="pb-2">
      {/* Zone 1: Navigation bar */}
      <div className="flex items-center justify-between gap-2 pb-4 relative">
        {/* Left: Title */}
        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight min-w-0 truncate">
          {formatTitle(currentDate, view)}
        </h2>

        {/* Center: View switcher — desktop only, absolutely centered */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
          <div
            ref={viewTabsRef}
            className="relative flex bg-slate-100 rounded-full p-1"
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
                className={`relative z-10 px-5 py-1.5 text-sm font-semibold transition-colors duration-200 rounded-full cursor-pointer ${
                  view === v
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-600'
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
          <div className="flex items-center border border-slate-200 rounded-full overflow-hidden">
            <button
              onClick={onNavigateBack}
              className="px-2 sm:px-3 py-2 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={onToday}
              className="px-3 sm:px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors border-l border-r border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
            >
              <span className="hidden sm:inline">Today</span>
              <span className="sm:hidden text-xs">Now</span>
            </button>
            <button
              onClick={onNavigateForward}
              className="px-2 sm:px-3 py-2 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Create button with dropdown */}
          <div ref={createBtnRef} className="relative flex items-center">
            <button
              onClick={() => setCreateDropdownOpen(o => !o)}
              className={`flex items-center gap-2 pl-3 sm:pl-4 pr-3 py-2 text-white text-sm font-semibold rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${createDropdownOpen ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-800'}`}
              aria-label="Create"
              aria-expanded={createDropdownOpen}
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
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden p-1.5 space-y-0.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-1.5">Meetings</p>
                    <button
                      onClick={() => { onCreateEvent(); setCreateDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Schedule Meeting</p>
                        <p className="text-xs text-slate-500">Informal, added instantly</p>
                      </div>
                    </button>

                    <div className="h-px bg-slate-100 mx-3 my-1" />
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-1.5">School Events</p>
                    <button
                      onClick={() => { onPlanEvent?.(); setCreateDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Plan Event</p>
                        <p className="text-xs text-slate-500">Formal — AV, facilities &amp; approval</p>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Zone 2: Filter bar */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        {/* Search input */}
        <div className="relative flex-shrink-0 w-48 sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-full bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus:border-primary-300 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" aria-label="Clear search">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Filter button — opens filter popover with categories + athletics */}
        {(categories.length > 0 || userCampuses.length > 0) && (
          <>
            <button
              ref={filterBtnRef}
              onClick={() => setFilterOpen((o) => !o)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                activeFilterCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <CalendarFilterPopover
              isOpen={filterOpen}
              onClose={() => setFilterOpen(false)}
              filter={calendarFilter}
              onFilterChange={onCalendarFilterChange}
              categories={categories}
              athleticsVisible={athleticsVisible}
              userCampuses={userCampuses}
              visibleAthleticsCampusIds={visibleAthleticsCampusIds}
              onToggleAthleticsCampus={onToggleAthleticsCampus}
              onToggleAllAthletics={onToggleAllAthletics}
              campuses={campuses}
              sports={sports}
              anchorRef={filterBtnRef}
            />
          </>
        )}
      </div>

      {/* Mobile view switcher */}
      <div
        ref={mobileTabsRef}
        className="relative flex sm:hidden bg-slate-100 rounded-full p-1 mt-4"
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
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {viewLabels[v]}
          </button>
        ))}
      </div>

      {/* Day column headers (week/day views only) */}
      {(view === 'week' || view === 'day') && (
        <div className="flex pt-4">
          <div className="w-14 flex-shrink-0" />
          {view === 'week' && (
            <div className="flex-1 grid grid-cols-7">
              {weekDates.map((date, i) => {
                const today = isToday(date)
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className={`text-xs font-medium uppercase tracking-wider ${today ? 'text-primary-600' : 'text-slate-400'}`}>
                      {dayNamesFull[date.getDay()].slice(0, 3)}
                    </span>
                    <span
                      className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                        today
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-900'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {view === 'day' && (() => {
            const today = isToday(currentDate)
            return (
              <div className="flex flex-col items-center gap-0.5">
                <span className={`text-xs font-medium uppercase tracking-wider ${today ? 'text-primary-600' : 'text-slate-400'}`}>
                  {dayNamesFull[currentDate.getDay()].slice(0, 3)}
                </span>
                <span
                  className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                    today
                      ? 'bg-primary-600 text-white'
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
