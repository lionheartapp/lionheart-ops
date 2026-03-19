'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { getEventAriaLabel } from './a11y-helpers'
import { Trophy, X } from 'lucide-react'
import CampusShapeIndicator, { getShapeIndex } from './CampusShapeIndicator'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'
import { useSpecialDays, SPECIAL_DAY_COLORS } from '@/lib/hooks/useAcademicCalendar'

interface MonthViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
  onDateClick: (date: Date) => void
  campusShapeMap: Map<string, number>
  meetWithPeople?: MeetWithPerson[]
  meetWithEvents?: Map<string, CalendarEventData[]>
  isLoading?: boolean
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

export default function MonthView({ currentDate, events, onEventClick, onDateClick, campusShapeMap, meetWithPeople = [], meetWithEvents = new Map(), isLoading }: MonthViewProps) {
  // Compute month range for special days query
  const monthRange = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const start = new Date(firstDay)
    start.setDate(start.getDate() - start.getDay())
    const lastDay = new Date(year, month + 1, 0)
    const end = new Date(lastDay)
    end.setDate(end.getDate() + (6 - end.getDay()))
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }, [currentDate])
  const { data: specialDays = [] } = useSpecialDays(monthRange.start, monthRange.end)
  const specialDaysByDate = useMemo(() => {
    const map = new Map<string, typeof specialDays[0]>()
    for (const sd of specialDays) {
      const d = new Date(sd.date)
      map.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, sd)
    }
    return map
  }, [specialDays])

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

  // Build meet-with events by date
  const meetWithEventsByDate = useMemo(() => {
    if (meetWithPeople.length === 0) return new Map<string, Array<{ event: CalendarEventData; person: MeetWithPerson }>>()
    const map = new Map<string, Array<{ event: CalendarEventData; person: MeetWithPerson }>>()
    for (const person of meetWithPeople) {
      const personEvents = meetWithEvents.get(person.id) || []
      for (const event of personEvents) {
        const start = new Date(event.startTime)
        const end = new Date(event.endTime)
        const current = new Date(start)
        while (current <= end) {
          const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push({ event, person })
          current.setDate(current.getDate() + 1)
        }
      }
    }
    return map
  }, [meetWithPeople, meetWithEvents])

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

  // "+N more" popover state
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const handleMoreClick = useCallback((e: React.MouseEvent, date: Date) => {
    e.stopPropagation()
    const btn = e.currentTarget as HTMLElement
    const rect = btn.getBoundingClientRect()
    setPopoverPos({ top: rect.bottom + 4, left: rect.left })
    setExpandedDay(dateKey(date))
  }, [])

  // Close popover on outside click
  useEffect(() => {
    if (!expandedDay) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setExpandedDay(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expandedDay])

  return (
    <div className="flex-1 flex flex-col overflow-hidden" role="grid" aria-label="Calendar month view">
      {/* Day headers */}
      <div className="grid grid-cols-7" role="row">
        {dayNames.map((day) => (
          <div key={day} role="columnheader" className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-200">
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
              const meetWithDayEvents = meetWithEventsByDate.get(dk) || []
              const specialDay = specialDaysByDate.get(dk)
              const allDayEvents = dayEvents.filter((e) => e.isAllDay)
              const timedEvents = dayEvents.filter((e) => !e.isAllDay)
              const sortedEvents = [...allDayEvents, ...timedEvents]
              const maxVisible = weeks.length <= 4 ? 5 : weeks.length <= 5 ? 4 : 3
              const totalEvents = sortedEvents.length + meetWithDayEvents.length
              const moreCount = totalEvents - maxVisible
              const meetWithSlots = Math.max(0, maxVisible - sortedEvents.length)
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
                  className={`border-r border-b border-slate-100 last:border-r-0 p-2 cursor-pointer hover:bg-slate-50/50 transition-colors flex flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                    !isCurrentMonth ? 'bg-slate-50/40' : ''
                  }`}
                >
                  {/* Special day banner */}
                  {specialDay && (() => {
                    const sdColors = SPECIAL_DAY_COLORS[specialDay.type] || SPECIAL_DAY_COLORS.OTHER
                    return (
                      <div
                        className="text-[9px] font-medium truncate px-1 py-0.5 rounded -mx-1 mb-0.5 flex-shrink-0"
                        style={{ backgroundColor: sdColors.bg, color: sdColors.text }}
                        title={specialDay.name}
                      >
                        {specialDay.name}
                      </div>
                    )
                  })()}

                  {/* Date number */}
                  <div className="flex justify-end mb-1 flex-shrink-0">
                    <span
                      className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full ${
                        today
                          ? 'bg-primary-600 text-white'
                          : isCurrentMonth
                            ? 'text-slate-900'
                            : 'text-slate-400'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {isLoading ? (
                      /* Skeleton pills */
                      ((wi * 7 + di) % 3 > 0) && Array.from({ length: (wi * 7 + di) % 3 }, (_, pi) => (
                        <div
                          key={pi}
                          className="h-5 rounded-md bg-slate-100 animate-pulse"
                          style={{ width: `${60 + ((wi * 7 + di + pi) % 3) * 15}%` }}
                        />
                      ))
                    ) : (
                    <>
                    {sortedEvents.slice(0, maxVisible).map((event) =>
                      event.isAllDay ? (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                          aria-label={getEventAriaLabel(event)}
                          className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium text-white truncate hover:brightness-90 transition-[filter]"
                          style={{ backgroundColor: getEventColor(event) }}
                        >
                          <CampusShapeIndicator
                            shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                            color="rgba(255,255,255,0.85)"
                            size={8}
                          />
                          {!!(event.metadata as any)?.athleticsType && <Trophy className="w-3 h-3 flex-shrink-0 opacity-80" />}
                          <span className="truncate">{event.title}</span>
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
                          <CampusShapeIndicator
                            shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                            color={getEventColor(event)}
                            size={8}
                          />
                          {!!(event.metadata as any)?.athleticsType && <Trophy className="w-3 h-3 flex-shrink-0 opacity-70" />}
                          <span className="truncate">
                            <span className="font-medium">{formatTime(event.startTime)} </span>
                            {event.title}
                          </span>
                        </button>
                      )
                    )}
                    {/* Meet-with people's events (inline merge) */}
                    {meetWithDayEvents.slice(0, meetWithSlots).map(({ event: mwEvent, person }) => (
                      <button
                        key={`mw-${person.id}-${mwEvent.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(mwEvent)
                        }}
                        title={`${person.firstName || person.email}'s event`}
                        className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs truncate opacity-60 hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: `${person.color}10`, color: person.color }}
                      >
                        <div className="w-1 h-full min-h-[14px] rounded-full flex-shrink-0" style={{ backgroundColor: person.color }} />
                        <span className="truncate">
                          {!mwEvent.isAllDay && <span className="font-medium">{formatTime(mwEvent.startTime)} </span>}
                          {mwEvent.title}
                        </span>
                      </button>
                    ))}
                    {moreCount > 0 && (
                      <button
                        onClick={(e) => handleMoreClick(e, date)}
                        className="w-full text-left px-2 py-0.5 text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        +{moreCount} more
                      </button>
                    )}
                    </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* "+N more" popover — portal to body so it floats above everything */}
      {expandedDay && popoverPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-1"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">
              {(() => {
                const parts = expandedDay.split('-')
                const d = new Date(+parts[0], +parts[1], +parts[2])
                return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
              })()}
            </span>
            <button
              onClick={() => setExpandedDay(null)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* All events for this day */}
          {(() => {
            const dayEvents = eventsByDate.get(expandedDay) || []
            const meetDayEvents = meetWithEventsByDate.get(expandedDay) || []
            const allDay = dayEvents.filter((e) => e.isAllDay)
            const timed = dayEvents.filter((e) => !e.isAllDay)
            const sorted = [...allDay, ...timed]

            return (
              <>
                {sorted.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setExpandedDay(null)
                      onEventClick(event)
                    }}
                    className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors"
                  >
                    <CampusShapeIndicator
                      shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                      color={getEventColor(event)}
                      size={8}
                    />
                    {event.isAllDay ? (
                      <span
                        className="flex-1 truncate font-medium px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: getEventColor(event) }}
                      >
                        {event.title}
                      </span>
                    ) : (
                      <span className="flex-1 truncate" style={{ color: getEventColor(event) }}>
                        <span className="font-medium">{formatTime(event.startTime)} </span>
                        {event.title}
                      </span>
                    )}
                  </button>
                ))}
                {meetDayEvents.map(({ event: mwEvent, person }) => (
                  <button
                    key={`mw-${person.id}-${mwEvent.id}`}
                    onClick={() => {
                      setExpandedDay(null)
                      onEventClick(mwEvent)
                    }}
                    className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-1.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: person.color }} />
                    <span className="flex-1 truncate" style={{ color: person.color }}>
                      {!mwEvent.isAllDay && <span className="font-medium">{formatTime(mwEvent.startTime)} </span>}
                      {mwEvent.title}
                    </span>
                  </button>
                ))}
                {sorted.length === 0 && meetDayEvents.length === 0 && (
                  <p className="text-xs text-slate-400 py-2 text-center">No events</p>
                )}
              </>
            )
          })()}
        </div>,
        document.body
      )}
    </div>
  )
}
