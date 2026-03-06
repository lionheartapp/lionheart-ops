'use client'

import { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarNavigation, computeDateRange } from '@/lib/hooks/useCalendar'
import type { CalendarViewType, CalendarEventData } from '@/lib/hooks/useCalendar'
import MonthView from '@/components/calendar/MonthView'
import WeekView from '@/components/calendar/WeekView'
import DayView from '@/components/calendar/DayView'
import AgendaView from '@/components/calendar/AgendaView'
import type { PmCalendarEvent } from '@/lib/types/pm-schedule'

// ─── Auth Headers ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

// ─── Adapter: PM event → CalendarEventData ────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
}

function pmEventToCalendarEvent(pm: PmCalendarEvent): CalendarEventData {
  return {
    id: pm.id,
    calendarId: 'pm-calendar',
    title: pm.title,
    description: pm.assetName || null,
    startTime: pm.start,
    endTime: pm.end,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isAllDay: true,
    calendarStatus: 'PUBLISHED',
    locationText: pm.locationName || null,
    calendar: {
      id: 'pm-calendar',
      name: 'PM Calendar',
      color: STATUS_COLORS[pm.color] || STATUS_COLORS.blue,
      calendarType: 'MAINTENANCE',
    },
  }
}

// ─── Title formatter (mirrors CalendarToolbar) ────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatTitle(date: Date, view: CalendarViewType): string {
  if (view === 'day') return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  if (view === 'week') return `${MONTHS[date.getMonth()]}, ${date.getFullYear()}`
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

// ─── Day column headers (week/day views) ──────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isToday(date: Date): boolean {
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
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

// ─── View labels ──────────────────────────────────────────────────────────────

const VIEW_LABELS: Record<CalendarViewType, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PmCalendarViewProps {
  onEventClick?: (event: PmCalendarEvent) => void
}

export default function PmCalendarView({ onEventClick }: PmCalendarViewProps) {
  const nav = useCalendarNavigation('pm-calendar-view')
  const { currentDate, view, changeView, goToToday, goNext, goPrev } = nav

  // Compute date range for fetching
  const dateRange = useMemo(() => computeDateRange(currentDate, view), [currentDate, view])

  // Fetch PM calendar events
  const { data: pmEvents = [], isLoading } = useQuery<PmCalendarEvent[]>({
    queryKey: ['pm-calendar-events', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: 'calendar',
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      })
      const res = await fetch(`/api/maintenance/pm-schedules?${params}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    },
    staleTime: 60_000,
  })

  // Convert PM events to CalendarEventData
  const calendarEvents = useMemo(
    () => pmEvents.map(pmEventToCalendarEvent),
    [pmEvents]
  )

  // Build a lookup from calendar event ID → original PM event
  const pmEventMap = useMemo(() => {
    const map = new Map<string, PmCalendarEvent>()
    for (const pm of pmEvents) map.set(pm.id, pm)
    return map
  }, [pmEvents])

  // Handle click on a calendar event — map back to PM event
  const handleEventClick = useCallback(
    (event: CalendarEventData) => {
      const pm = pmEventMap.get(event.id)
      if (pm && onEventClick) onEventClick(pm)
    },
    [pmEventMap, onEventClick]
  )

  const emptyCampusMap = useMemo(() => new Map<string, number>(), [])
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])

  const noopDate = useCallback(() => {}, [])
  const noopSlot = useCallback((_s: Date, _e: Date) => {}, [])

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Toolbar — matches CalendarToolbar visual style */}
      <div className="flex-shrink-0 pb-2">
        {/* Zone 1: Navigation bar */}
        <div className="flex items-center justify-between gap-2 pb-4">
          {/* Left: Title */}
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight min-w-0 truncate">
            {formatTitle(currentDate, view)}
          </h2>

          {/* Center: View switcher — desktop */}
          <div className="hidden sm:flex border border-gray-200 rounded-full overflow-hidden flex-shrink-0" role="tablist" aria-label="PM Calendar view">
            {(Object.keys(VIEW_LABELS) as CalendarViewType[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => changeView(v)}
                className={`w-20 text-center py-2 text-sm font-semibold transition-all cursor-pointer ${
                  view === v
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Right: Nav pill */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
              <button
                onClick={goPrev}
                className="px-2 sm:px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 sm:px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors border-l border-r border-gray-200 cursor-pointer"
              >
                <span className="hidden sm:inline">Today</span>
                <span className="sm:hidden text-xs">Now</span>
              </button>
              <button
                onClick={goNext}
                className="px-2 sm:px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile view switcher */}
        <div className="flex sm:hidden border border-gray-200 rounded-full overflow-hidden" role="tablist" aria-label="PM Calendar view">
          {(Object.keys(VIEW_LABELS) as CalendarViewType[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => changeView(v)}
              className={`flex-1 text-center py-2 text-xs font-semibold transition-all cursor-pointer ${
                view === v
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Day column headers (week/day views) */}
        {(view === 'week' || view === 'day') && (
          <div className="flex pt-4">
            <div className="w-14 flex-shrink-0" />
            {view === 'week' && (
              <div className="flex-1 grid grid-cols-7">
                {weekDates.map((date, i) => {
                  const today = isToday(date)
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <span className={`text-xs font-medium uppercase tracking-wider ${today ? 'text-primary-600' : 'text-gray-400'}`}>
                        {DAY_NAMES[date.getDay()]}
                      </span>
                      <span
                        className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                          today ? 'bg-primary-600 text-white' : 'text-gray-900'
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
                    {DAY_NAMES[currentDate.getDay()]}
                  </span>
                  <span
                    className={`w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full ${
                      today ? 'bg-primary-600 text-white' : 'text-gray-900'
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

      {/* Legend */}
      <div className="flex-shrink-0 flex items-center gap-4 text-xs text-gray-500 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Upcoming
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Overdue
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          Completed
        </div>
      </div>

      {/* Calendar view — fills remaining height */}
      {isLoading ? (
        <div className="flex-1 min-h-0 ui-glass p-8 animate-pulse">
          <div className="h-full bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 min-h-0 flex flex-col ui-glass overflow-hidden"
        >
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={calendarEvents}
              onEventClick={handleEventClick}
              onDateClick={noopDate}
              campusShapeMap={emptyCampusMap}
              isLoading={isLoading}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={calendarEvents}
              onEventClick={handleEventClick}
              onSlotClick={noopSlot}
              campusShapeMap={emptyCampusMap}
              isLoading={isLoading}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={calendarEvents}
              onEventClick={handleEventClick}
              onSlotClick={noopSlot}
              campusShapeMap={emptyCampusMap}
              isLoading={isLoading}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              currentDate={currentDate}
              events={calendarEvents}
              onEventClick={handleEventClick}
              campusShapeMap={emptyCampusMap}
              isLoading={isLoading}
            />
          )}
        </motion.div>
      )}
    </div>
  )
}
