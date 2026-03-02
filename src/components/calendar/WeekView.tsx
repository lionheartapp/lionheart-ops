'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { useDragToCreate } from '@/lib/hooks/useDragToCreate'
import { getEventAriaLabel } from './a11y-helpers'
import DraggableEvent from './DraggableEvent'

interface WeekViewProps {
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

function toDateOnly(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h = hour % 12 || 12
  return `${h} ${ampm}`
}

export default function WeekView({ currentDate, events, onEventClick, onSlotClick, onDragReschedule, onResize }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = useState(0)
  const { dragState, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, getGhostStyle, getGhostLabel } = useDragToCreate({ onSlotClick })

  const weekDates = useMemo(() => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentDate])

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEventData[] = []
    const timed: CalendarEventData[] = []
    for (const event of events) {
      if (event.isAllDay) allDay.push(event)
      else timed.push(event)
    }
    return { allDayEvents: allDay, timedEvents: timed }
  }, [events])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEventData[]>()
    for (const event of timedEvents) {
      const start = new Date(event.startTime)
      const dayIndex = weekDates.findIndex(
        (d) => d.getFullYear() === start.getFullYear() &&
          d.getMonth() === start.getMonth() &&
          d.getDate() === start.getDate()
      )
      if (dayIndex >= 0) {
        if (!map.has(dayIndex)) map.set(dayIndex, [])
        map.get(dayIndex)!.push(event)
      }
    }
    return map
  }, [timedEvents, weekDates])

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      const scrollTo = (now.getHours() - START_HOUR - 1) * HOUR_HEIGHT
      scrollRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [])

  // Measure column width for horizontal drag snapping
  useEffect(() => {
    if (!columnsRef.current) return
    const measure = () => {
      if (columnsRef.current) {
        setColumnWidth(columnsRef.current.offsetWidth / 7)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(columnsRef.current)
    return () => observer.disconnect()
  }, [])

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  const now = new Date()
  const nowMinutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes()
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
  const showNowLine = now.getHours() >= START_HOUR && now.getHours() < END_HOUR

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="flex pb-2 border-b border-gray-100 mb-0 px-4 sm:px-10">
          <div className="w-14 flex-shrink-0 text-[11px] text-gray-400 text-right pr-3 pt-1">All day</div>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {weekDates.map((date, i) => {
              const dayAllDay = allDayEvents.filter((e) => {
                const start = new Date(e.startTime)
                const end = new Date(e.endTime)
                return toDateOnly(date) >= toDateOnly(start) && toDateOnly(date) <= toDateOnly(end)
              })
              return (
                <div key={i} className="space-y-1">
                  {dayAllDay.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      aria-label={getEventAriaLabel(event)}
                      className="w-full text-left px-2 py-1 rounded-lg text-xs font-semibold truncate"
                      style={{
                        backgroundColor: `${getEventColor(event)}20`,
                        color: getEventColor(event),
                      }}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              )
            })}
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

          {/* Day columns */}
          <div ref={columnsRef} className="flex-1 grid grid-cols-7 gap-0 relative">
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

            {/* Day columns with events */}
            {weekDates.map((date, dayIndex) => {
              const dayEvents = eventsByDay.get(dayIndex) || []
              const ghostStyle = getGhostStyle(dragState?.dayDate ?? new Date(0), date)
              return (
                <div
                  key={dayIndex}
                  className="relative"
                  onPointerDown={(e) => handlePointerDown(date, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                >
                  {/* Hover targets */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 cursor-pointer border border-transparent rounded-lg hover:bg-primary-100/30 hover:border-dashed hover:border-primary-300 transition-colors"
                      style={{
                        top: (hour - START_HOUR) * HOUR_HEIGHT,
                        height: HOUR_HEIGHT,
                      }}
                    />
                  ))}

                  {/* Drag-to-create ghost */}
                  {ghostStyle && (
                    <div
                      className="bg-primary-100/50 border-2 border-dashed border-primary-400 rounded-xl flex items-start justify-start px-3 py-1.5"
                      style={ghostStyle}
                    >
                      <span className="text-xs font-medium text-primary-700 select-none">
                        {getGhostLabel()}
                      </span>
                    </div>
                  )}

                  {/* Event blocks */}
                  {dayEvents.map((event) => {
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
                          date={date}
                          siblingEvents={timedEvents}
                          onDragReschedule={onDragReschedule}
                          onResize={onResize}
                          onClick={onEventClick}
                          dragAxis="both"
                          columnWidth={columnWidth}
                          weekDates={weekDates}
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
                        className="absolute left-1 right-1 rounded-xl px-3 py-2 text-left overflow-hidden z-[1] hover:z-[2] hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
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
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
