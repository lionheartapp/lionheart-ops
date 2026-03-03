'use client'

import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import type { CalendarViewType } from '@/lib/hooks/useCalendar'

interface CategoryChip {
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
  searchQuery: string
  onSearchChange: (query: string) => void
  categories: CategoryChip[]
  activeCategories: Set<string>
  onToggleCategory: (categoryId: string) => void
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
  searchQuery,
  onSearchChange,
  categories,
  activeCategories,
  onToggleCategory,
}: CalendarToolbarProps) {
  const weekDates = getWeekDates(currentDate)

  return (
    <div className="pb-2 space-y-5">
      {/* Row 1: Title + Nav pill + Create button */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Title */}
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight min-w-0 truncate">
          {formatTitle(currentDate, view)}
        </h2>

        {/* Center: View switcher — desktop only */}
        <div className="hidden sm:flex border border-gray-200 rounded-full overflow-hidden flex-shrink-0" role="tablist" aria-label="Calendar view">
          {(Object.keys(viewLabels) as CalendarViewType[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              aria-current={view === v ? 'true' : undefined}
              onClick={() => onViewChange(v)}
              className={`w-20 text-center py-2 text-sm font-semibold transition-all ${
                view === v
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>

        {/* Right: Nav pill + Create button */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Nav group in a single bordered pill */}
          <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
            <button
              onClick={onNavigateBack}
              className="px-2 sm:px-3 py-2 hover:bg-gray-50 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onToday}
              className="px-3 sm:px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors border-l border-r border-gray-200"
            >
              <span className="hidden sm:inline">Today</span>
              <span className="sm:hidden text-xs">Now</span>
            </button>
            <button
              onClick={onNavigateForward}
              className="px-2 sm:px-3 py-2 hover:bg-gray-50 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <button
            onClick={onCreateEvent}
            className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-full hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Event</span>
          </button>
        </div>
      </div>

      {/* Search + Category Filters */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-shrink-0 w-48 sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => {
              const isActive = activeCategories.has(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => onToggleCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isActive ? { backgroundColor: cat.color } : undefined}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? '#fff' : cat.color }}
                  />
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Row 2: View switcher — mobile only */}
      <div className="flex sm:hidden border border-gray-200 rounded-full overflow-hidden" role="tablist" aria-label="Calendar view">
        {(Object.keys(viewLabels) as CalendarViewType[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            aria-current={view === v ? 'true' : undefined}
            onClick={() => onViewChange(v)}
            className={`flex-1 text-center py-2 text-xs font-semibold transition-all ${
              view === v
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {viewLabels[v]}
          </button>
        ))}
      </div>

      {/* Day column headers (week/day views only) */}
      {(view === 'week' || view === 'day') && (
        <div className="flex">
          <div className="w-14 flex-shrink-0" />
          {view === 'week' && (
            <div className="flex-1 grid grid-cols-7">
              {weekDates.map((date, i) => {
                const today = isToday(date)
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className={`text-xs font-medium uppercase tracking-wider ${today ? 'text-primary-600' : 'text-gray-400'}`}>
                      {dayNamesFull[date.getDay()].slice(0, 3)}
                    </span>
                    <span
                      className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                        today
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-900'
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
                <span className={`text-xs font-medium uppercase tracking-wider ${today ? 'text-primary-600' : 'text-gray-400'}`}>
                  {dayNamesFull[currentDate.getDay()].slice(0, 3)}
                </span>
                <span
                  className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                    today
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-900'
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
