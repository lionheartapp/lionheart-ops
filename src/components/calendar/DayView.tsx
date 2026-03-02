'use client'

import { useMemo, useEffect, useRef } from 'react'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { getEventAriaLabel } from './a11y-helpers'
import DraggableEvent from './DraggableEvent'

interface DayViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
  onSlotClick: (start: Date, end: Date) => void
  onDragReschedule?: (event: CalendarEventData, deltaMinutes: number, deltaDays: number) => void
  onResize?: (event: CalendarEventData, deltaMinutes: number) => void
}

const HOUR_HEIGHT = 64
const START_HOUR = 0
const END_HOUR = 24

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h = hour % 12 || 12
  return `${h} ${ampm}`
}

export default function DayView({ currentDate, events, onEventClick, onSlotClick, onDragReschedule, onResize }: DayViewProps) {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex items-center gap-3 py-4 border-b border-gray-100 mb-0 px-4 sm:px-10">
          <span className="w-14 flex-shrink-0 text-[11px] text-gray-400 text-right pr-3">All day</span>
          <div className="flex gap-1">
            {allDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                aria-label={getEventAriaLabel(event)}
                className="text-left px-3 py-1.5 rounded-lg text-sm font-semibold truncate"
                style={{
                  backgroundColor: `${getEventColor(event)}20`,
                  color: getEventColor(event),
                }}
              >
                {event.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white calendar-scroll">
        <div className="flex relative pl-4 sm:pl-10 pr-4" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-3 text-xs text-gray-400"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 7 }}
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
                className="absolute left-0 right-0 cursor-pointer hover:bg-primary-50/20 transition-colors"
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
              const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 28)

              if (onDragReschedule) {
                return (
                  <DraggableEvent
                    key={event.id}
                    event={event}
                    top={top}
                    height={height}
                    date={currentDate}
                    siblingEvents={timedEvents}
                    onDragReschedule={onDragReschedule}
                    onResize={onResize}
                    onClick={onEventClick}
                    dragAxis="y"
                    className="right-4"
                  >
                    <div className="font-semibold text-sm truncate" style={{ color: getEventColor(event) }}>
                      {event.title}
                    </div>
                    {height > 36 && (
                      <div className="text-xs mt-0.5 opacity-60" style={{ color: getEventColor(event) }}>
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {height > 56 && event.locationText && (
                      <div className="text-xs mt-0.5 opacity-40" style={{ color: getEventColor(event) }}>
                        {event.locationText}
                      </div>
                    )}
                  </DraggableEvent>
                )
              }

              return (
                <button
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                  aria-label={getEventAriaLabel(event)}
                  className="absolute left-1 right-4 rounded-xl px-4 py-2 text-left overflow-hidden z-[1] hover:z-[2] hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
                  style={{
                    top,
                    height,
                    backgroundColor: `${getEventColor(event)}20`,
                  }}
                >
                  <div className="font-semibold text-sm truncate" style={{ color: getEventColor(event) }}>
                    {event.title}
                  </div>
                  {height > 36 && (
                    <div className="text-xs mt-0.5 opacity-60" style={{ color: getEventColor(event) }}>
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {height > 56 && event.locationText && (
                    <div className="text-xs mt-0.5 opacity-40" style={{ color: getEventColor(event) }}>
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
