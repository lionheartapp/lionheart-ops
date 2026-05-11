'use client'

import { useMemo } from 'react'
import { Clock, MapPin, Users as UsersIcon, Trophy, Repeat } from 'lucide-react'
import { getEventColor, getEventMetadata, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { getEventAriaLabel } from './a11y-helpers'
import CampusShapeIndicator, { getShapeIndex } from './CampusShapeIndicator'
import { AgendaViewSkeletons } from './EventSkeletons'

interface AgendaViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
  campusShapeMap: Map<string, number>
  isLoading?: boolean
}

function formatDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
}

function formatTimeRange(startStr: string, endStr: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day'
  const start = new Date(startStr)
  const end = new Date(endStr)
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
}

export default function AgendaView({ currentDate, events, onEventClick, campusShapeMap, isLoading }: AgendaViewProps) {
  // Group events by date
  const grouped = useMemo(() => {
    const map = new Map<string, { date: Date; events: CalendarEventData[] }>()

    for (const event of events) {
      const start = new Date(event.startTime)
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`
      if (!map.has(key)) {
        map.set(key, { date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), events: [] })
      }
      map.get(key)!.events.push(event)
    }

    // Sort by date
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events])

  if (isLoading) {
    return <AgendaViewSkeletons />
  }

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium">No upcoming events</p>
          <p className="text-sm mt-1">Events will appear here as they&apos;re scheduled</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 px-4 sm:px-10 py-4 calendar-scroll">
      {grouped.map(({ date, events: dayEvents }) => (
        <div key={date.toISOString()}>
          {/* Sticky date header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-stone-100 -mx-4">
            <div className="flex items-center gap-2.5 px-4">
              {isToday(date) && (
                <span className="w-2 h-2 rounded-full bg-slate-900" />
              )}
              <span className={`text-sm font-semibold ${isToday(date) ? 'text-slate-900' : 'text-stone-700'}`}>
                {isToday(date) ? 'Today' : formatDate(date)}
              </span>
              <span className="text-xs text-stone-400">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Event cards */}
          <div className="space-y-3 pt-3">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                aria-label={getEventAriaLabel(event)}
                className="w-full text-left px-4 py-3.5 rounded-xl bg-white group transition-all hover:shadow-md"
                style={{ boxShadow: 'rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.06) 0px 0px 0px 1px, rgba(34,42,53,0.04) 0px 4px 8px 0px' }}
              >
                <div className="flex gap-3">
                  {/* Color bar */}
                  <div
                    className="w-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getEventColor(event) }}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Title + calendar chip */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-slate-900 truncate flex items-center gap-1">
                        {!!getEventMetadata(event)?.athleticsType && <Trophy className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 opacity-70" />}
                        {(event.rrule || event.parentEventId) && <Repeat className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 opacity-60" />}
                        {event.title}
                      </h4>
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1"
                        style={{
                          backgroundColor: `${getEventColor(event)}15`,
                          color: getEventColor(event),
                        }}
                      >
                        <CampusShapeIndicator
                          shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                          color={getEventColor(event)}
                          size={8}
                        />
                        {event.calendar.name}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-stone-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{formatTimeRange(event.startTime, event.endTime, event.isAllDay)}</span>
                    </div>

                    {/* Location */}
                    {event.locationText && (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400">
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
                              className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center"
                              title={a.user.name || a.user.firstName || ''}
                            >
                              {a.user.avatar ? (
                                <img src={a.user.avatar} alt="" className="w-full h-full rounded-full" />
                              ) : (
                                <span className="text-xs font-medium text-stone-600">
                                  {(a.user.firstName?.[0] || a.user.name?.[0] || '?').toUpperCase()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {event.attendees.length > 4 && (
                          <span className="text-xs text-stone-400">+{event.attendees.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
