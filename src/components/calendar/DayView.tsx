'use client'

import { useMemo, useEffect, useRef } from 'react'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

interface DayViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
  onSlotClick: (start: Date, end: Date) => void
}

const HOUR_HEIGHT = 64
const START_HOUR = 6
const END_HOUR = 22

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 || 12
  return `${h} ${ampm}`
}

export default function DayView({ currentDate, events, onEventClick, onSlotClick }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEventData[] = []
    const timed: CalendarEventData[] = []
    for (const event of events) {
      if (event.isAllDay) allDay.push(event)
      else timed.push(event)
    }
    return { allDayEvents: allDay, timedEvents: timed }
  }, [events])

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      const scrollTo = (now.getHours() - START_HOUR - 1) * HOUR_HEIGHT
      scrollRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [])

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  const now = new Date()
  const isToday =
    currentDate.getFullYear() === now.getFullYear() &&
    currentDate.getMonth() === now.getMonth() &&
    currentDate.getDate() === now.getDate()
  const nowMinutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes()
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
  const showNowLine = isToday && now.getHours() >= START_HOUR && now.getHours() < END_HOUR

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="flex-1 flex flex-col overflow-hidden border border-gray-200 rounded-lg">
      {/* Day header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
            isToday ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
          }`}>
            {currentDate.getDate()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{days[currentDate.getDay()]}</div>
            <div className="text-sm text-gray-500">
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
          </div>
        </div>
        {timedEvents.length > 0 && (
          <span className="text-sm text-gray-400">
            {timedEvents.length} event{timedEvents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50/50 space-y-1">
          <div className="text-xs font-medium text-gray-400 uppercase">All Day</div>
          {allDayEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="w-full text-left px-3 py-1.5 rounded-md text-sm font-medium truncate"
              style={{
                backgroundColor: `${event.calendar.color}15`,
                color: event.calendar.color,
              }}
            >
              {event.title}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-20 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-3 text-xs text-gray-400"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 6 }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Main column */}
          <div className="flex-1 relative">
            {/* Hour lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}

            {/* Now line */}
            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: nowTop }}
              >
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}

            {/* Click targets */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 cursor-pointer hover:bg-primary-50/30 transition-colors"
                style={{
                  top: (hour - START_HOUR) * HOUR_HEIGHT,
                  height: HOUR_HEIGHT,
                }}
                onClick={() => {
                  const start = new Date(currentDate)
                  start.setHours(hour, 0, 0, 0)
                  const end = new Date(currentDate)
                  end.setHours(hour + 1, 0, 0, 0)
                  onSlotClick(start, end)
                }}
              />
            ))}

            {/* Event blocks */}
            {timedEvents.map((event) => {
              const start = new Date(event.startTime)
              const end = new Date(event.endTime)
              const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes()
              const endMinutes = (end.getHours() - START_HOUR) * 60 + end.getMinutes()
              const top = (startMinutes / 60) * HOUR_HEIGHT
              const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 24)

              return (
                <button
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                  className="absolute left-1 right-4 rounded-lg px-3 py-2 text-sm overflow-hidden z-[1] hover:z-[2] hover:shadow-lg transition-shadow cursor-pointer"
                  style={{
                    top,
                    height,
                    backgroundColor: `${event.calendar.color}12`,
                    borderLeft: `4px solid ${event.calendar.color}`,
                  }}
                >
                  <div className="font-semibold truncate" style={{ color: event.calendar.color }}>
                    {event.title}
                  </div>
                  {height > 36 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  )}
                  {height > 56 && event.locationText && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {event.locationText}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
