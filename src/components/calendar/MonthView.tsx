'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

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

    // Start from the Sunday of the week containing the 1st
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    // End on the Saturday after the last day
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

  // Map events to their dates
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventData[]>()
    for (const event of events) {
      const start = new Date(event.startTime)
      const end = new Date(event.endTime)
      const current = new Date(start)

      // For multi-day events, add to each day
      while (current <= end) {
        const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(event)
        current.setDate(current.getDate() + 1)
      }
    }
    return map
  }, [events])

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex-1 flex flex-col">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {dayNames.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div className="flex-1 grid grid-rows-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 min-h-[100px]">
            {week.map((date, di) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const today = isToday(date)
              const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
              const dayEvents = eventsByDate.get(dateKey) || []
              const maxVisible = 3
              const moreCount = dayEvents.length - maxVisible

              return (
                <div
                  key={di}
                  onClick={() => onDateClick(date)}
                  className={`border-r border-gray-100 last:border-r-0 p-1.5 cursor-pointer hover:bg-gray-50/50 transition-colors ${
                    !isCurrentMonth ? 'bg-gray-50/30' : ''
                  }`}
                >
                  {/* Date number */}
                  <div className="flex justify-center mb-1">
                    <span
                      className={`w-7 h-7 flex items-center justify-center text-sm rounded-full ${
                        today
                          ? 'bg-primary-600 text-white font-semibold'
                          : isCurrentMonth
                            ? 'text-gray-900'
                            : 'text-gray-400'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, maxVisible).map((event) => (
                      <motion.button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(event)
                        }}
                        whileHover={{ scale: 1.02 }}
                        className="w-full text-left px-1.5 py-0.5 rounded text-xs truncate"
                        style={{
                          backgroundColor: `${event.calendar.color}15`,
                          color: event.calendar.color,
                          borderLeft: `2px solid ${event.calendar.color}`,
                        }}
                      >
                        {!event.isAllDay && (
                          <span className="font-medium">{formatTime(event.startTime)} </span>
                        )}
                        {event.title}
                      </motion.button>
                    ))}
                    {moreCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDateClick(date)
                        }}
                        className="w-full text-left px-1.5 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
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
