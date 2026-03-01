'use client'

import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react'
import type { CalendarViewType } from '@/lib/hooks/useCalendar'

interface CalendarToolbarProps {
  currentDate: Date
  view: CalendarViewType
  onViewChange: (view: CalendarViewType) => void
  onNavigateBack: () => void
  onNavigateForward: () => void
  onToday: () => void
  onCreateEvent: () => void
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
}: CalendarToolbarProps) {
  const weekDates = getWeekDates(currentDate)

  return (
    <div className="pb-5 space-y-4">
      {/* Row 1: Title | View switcher pill | Nav pill + Create */}
      <div className="flex items-center justify-between">
        {/* Left: Title — fixed width so center tabs don't shift */}
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight w-72">
          {formatTitle(currentDate, view)}
        </h2>

        {/* Center: View switcher — single bordered pill */}
        <div className="flex border border-gray-200 rounded-full overflow-hidden">
          {(Object.keys(viewLabels) as CalendarViewType[]).map((v) => (
            <button
              key={v}
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
        <div className="flex items-center gap-3">
          {/* Nav group in a single bordered pill */}
          <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
            <button
              onClick={onNavigateBack}
              className="px-3 py-2 hover:bg-gray-50 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onToday}
              className="px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors border-l border-r border-gray-200"
            >
              Today
            </button>
            <button
              onClick={onNavigateForward}
              className="px-3 py-2 hover:bg-gray-50 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <button
            onClick={onCreateEvent}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-full hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Event</span>
          </button>
        </div>
      </div>

      {/* Row 2: Day header cards (week/day views only) */}
      {(view === 'week' || view === 'day') && (
        <div className="flex items-center gap-2">
          {/* Calendar icon */}
          <div className="w-10 flex-shrink-0 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
          </div>

          {/* Day cards */}
          {view === 'week' && weekDates.map((date, i) => {
            const today = isToday(date)
            return (
              <div
                key={i}
                className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-colors ${
                  today
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className={`text-[11px] font-semibold tracking-wide ${today ? 'text-gray-300' : 'text-gray-500'}`}>
                  {dayNamesFull[date.getDay()]}
                </div>
                <div className="text-2xl font-bold mt-0.5">
                  {date.getDate()}
                </div>
              </div>
            )
          })}

          {view === 'day' && (() => {
            const today = isToday(currentDate)
            return (
              <div
                className={`inline-flex flex-col items-center px-10 py-2.5 rounded-2xl transition-colors ${
                  today
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className={`text-[11px] font-semibold tracking-wide ${today ? 'text-gray-300' : 'text-gray-500'}`}>
                  {dayNamesFull[currentDate.getDay()]}
                </div>
                <div className="text-2xl font-bold mt-0.5">
                  {currentDate.getDate()}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
