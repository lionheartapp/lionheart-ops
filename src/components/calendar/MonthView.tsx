'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { getEventAriaLabel } from './a11y-helpers'

interface MonthViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
  onDateClick: (date: Date) => void
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m ? `${hour}:${m.toString().padStart(2, '0')}${ampm}` : `${hour}${ampm}`
}

export default function MonthView({ currentDate, events, onEventClick, onDateClick }: MonthViewProps) {
  const weeks = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    const lastDay = new Date(year, month + 1, 0)
    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

    const weeks: Date[][] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }
      weeks.push(week)
    }

    return weeks
  }, [currentDate])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventData[]>()
    for (const event of events) {
      const start = new Date(event.startTime)
      const end = new Date(event.endTime)
      const current = new Date(start)

      while (current <= end) {
        const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(event)
        current.setDate(current.getDate() + 1)
      }
    }
    return map
  }, [events])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  // Keyboard grid navigation
  const [focusedDate, setFocusedDate] = useState<Date | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  // Focus the cell when focusedDate changes
  useEffect(() => {
    if (focusedDate) {
      const cell = cellRefs.current.get(dateKey(focusedDate))
      cell?.focus()
    }
  }, [focusedDate])

  // All dates in the grid, flattened
  const allDates = useMemo(() => weeks.flat(), [weeks])

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent, date: Date) => {
    let delta = 0
    switch (e.key) {
      case 'ArrowLeft': delta = -1; break
      case 'ArrowRight': delta = 1; break
      case 'ArrowUp': delta = -7; break
      case 'ArrowDown': delta = 7; break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onDateClick(date)
        return
      default:
        return
    }
    e.preventDefault()
    const currentIndex = allDates.findIndex((d) => isSameDay(d, date))
    const newIndex = currentIndex + delta
    if (newIndex >= 0 && newIndex < allDates.length) {
      setFocusedDate(allDates[newIndex])
    }
  }, [allDates, onDateClick])

  const setCellRef = useCallback((date: Date, el: HTMLDivElement | null) => {
    const key = dateKey(date)
    if (el) cellRefs.current.set(key, el)
    else cellRefs.current.delete(key)
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden" role="grid" aria-label="Calendar month view">
      {/* Day headers */}
      <div className="grid grid-cols-7" role="row">
        {dayNames.map((day) => (
          <div key={day} role="columnheader" className="py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-200">
            {day}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div ref={gridRef} className="flex-1 flex flex-col">
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7 flex-1 min-h-0">
            {week.map((date, di) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const today = isToday(date)
              const dk = dateKey(date)
              const dayEvents = eventsByDate.get(dk) || []
              const allDayEvents = dayEvents.filter((e) => e.isAllDay)
              const timedEvents = dayEvents.filter((e) => !e.isAllDay)
              const sortedEvents = [...allDayEvents, ...timedEvents]
              const maxVisible = weeks.length <= 4 ? 5 : weeks.length <= 5 ? 4 : 3
              const moreCount = sortedEvents.length - maxVisible
              const isFocused = focusedDate ? isSameDay(date, focusedDate) : (wi === 0 && di === 0)

              return (
                <div
                  key={di}
                  ref={(el) => setCellRef(date, el)}
                  role="gridcell"
                  tabIndex={isFocused ? 0 : -1}
                  aria-label={`${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}` : ''}`}
                  onClick={() => onDateClick(date)}
                  onKeyDown={(e) => handleGridKeyDown(e, date)}
                  onFocus={() => setFocusedDate(date)}
                  className={`border-r border-b border-gray-100 last:border-r-0 p-2 cursor-pointer hover:bg-gray-50/50 transition-colors flex flex-col overflow-hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 ${
                    !isCurrentMonth ? 'bg-gray-50/40' : ''
                  }`}
                >
                  {/* Date number */}
                  <div className="flex justify-end mb-1 flex-shrink-0">
                    <span
                      className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full ${
                        today
                          ? 'bg-primary-600 text-white'
                          : isCurrentMonth
                            ? 'text-gray-900'
                            : 'text-gray-300'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {sortedEvents.slice(0, maxVisible).map((event) =>
                      event.isAllDay ? (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                          aria-label={getEventAriaLabel(event)}
                          className="w-full text-left px-1.5 py-0.5 rounded-md text-xs font-medium text-white truncate hover:brightness-90 transition-[filter]"
                          style={{ backgroundColor: getEventColor(event) }}
                        >
                          {event.title}
                        </button>
                      ) : (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                          aria-label={getEventAriaLabel(event)}
                          className="w-full text-left flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-xs truncate hover:brightness-95 transition-[filter]"
                          style={{ backgroundColor: `${getEventColor(event)}12`, color: getEventColor(event) }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getEventColor(event) }}
                          />
                          <span className="truncate">
                            <span className="font-medium">{formatTime(event.startTime)} </span>
                            {event.title}
                          </span>
                        </button>
                      )
                    )}
                    {moreCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDateClick(date)
                        }}
                        className="w-full text-left px-2 py-0.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        +{moreCount} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
