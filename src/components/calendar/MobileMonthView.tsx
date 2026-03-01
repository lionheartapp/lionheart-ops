'use client'

import { useState, useMemo } from 'react'
import { Clock, MapPin } from 'lucide-react'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

interface MobileMonthViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function formatTimeRange(startStr: string, endStr: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day'
  const start = new Date(startStr)
  const end = new Date(endStr)
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function formatFullDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
}

export default function MobileMonthView({ currentDate, events, onEventClick }: MobileMonthViewProps) {
  // Initialize selectedDate: today if in current month, otherwise 1st of month
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date()
    if (today.getFullYear() === currentDate.getFullYear() && today.getMonth() === currentDate.getMonth()) {
      return new Date(today.getFullYear(), today.getMonth(), today.getDate())
    }
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  })

  // Reset selectedDate when month changes
  const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`
  const [prevMonthKey, setPrevMonthKey] = useState(monthKey)
  if (monthKey !== prevMonthKey) {
    setPrevMonthKey(monthKey)
    const today = new Date()
    if (today.getFullYear() === currentDate.getFullYear() && today.getMonth() === currentDate.getMonth()) {
      setSelectedDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    } else {
      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
    }
  }

  // Build weeks grid
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

  // Map events to dates
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

  // Events for selected date
  const selectedDateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || []

  const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Compact month grid */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaders.map((day, i) => (
            <div key={i} className="text-center text-[11px] font-medium text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Date cells */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date, di) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const today = isToday(date)
              const isSelected = isSameDay(date, selectedDate)
              const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
              const dayEvents = eventsByDate.get(dateKey) || []

              // Get unique colors for indicator dots (max 3)
              const dotColors = [...new Set(dayEvents.map(e => e.calendar.color))].slice(0, 3)

              return (
                <button
                  key={di}
                  onClick={() => setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))}
                  className="flex flex-col items-center py-1"
                >
                  <span
                    className={`w-8 h-8 flex items-center justify-center text-sm rounded-full ${
                      today
                        ? 'bg-primary-600 text-white font-semibold'
                        : isSelected
                          ? 'ring-2 ring-primary-500 font-medium text-gray-900'
                          : isCurrentMonth
                            ? 'text-gray-900'
                            : 'text-gray-300'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {/* Event indicator dots */}
                  <div className="flex gap-0.5 mt-0.5 h-1.5">
                    {dotColors.map((color, i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Selected date header */}
      <div className="sticky top-0 z-10 bg-white px-4 py-2.5 border-b border-gray-100">
        <span className={`text-sm font-semibold ${isToday(selectedDate) ? 'text-primary-600' : 'text-gray-900'}`}>
          {isToday(selectedDate) ? 'Today' : formatFullDate(selectedDate)}
        </span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {selectedDayEvents.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <p className="text-sm">No events on this day</p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {selectedDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white"
              >
                <div className="flex gap-3">
                  {/* Color bar */}
                  <div
                    className="w-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.calendar.color }}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Title + calendar chip */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-gray-900 truncate">{event.title}</h4>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: `${event.calendar.color}15`,
                          color: event.calendar.color,
                        }}
                      >
                        {event.calendar.name}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTimeRange(event.startTime, event.endTime, event.isAllDay)}
                    </div>

                    {/* Location */}
                    {event.locationText && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.locationText}
                        {event.building && ` · ${event.building.name}`}
                      </div>
                    )}

                    {/* Attendees */}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex -space-x-1.5">
                          {event.attendees.slice(0, 4).map((a) => (
                            <div
                              key={a.id}
                              className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                              title={a.user.name || a.user.firstName || ''}
                            >
                              {a.user.avatar ? (
                                <img src={a.user.avatar} alt="" className="w-full h-full rounded-full" />
                              ) : (
                                <span className="text-[9px] font-medium text-gray-600">
                                  {(a.user.firstName?.[0] || a.user.name?.[0] || '?').toUpperCase()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {event.attendees.length > 4 && (
                          <span className="text-xs text-gray-400">+{event.attendees.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
