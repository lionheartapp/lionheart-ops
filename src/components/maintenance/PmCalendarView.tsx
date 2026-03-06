'use client'

import { useState, useCallback, useMemo } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList } from 'lucide-react'
import PmCalendarEvent from './PmCalendarEvent'
import type { PmCalendarEvent as PmCalendarEventType } from '@/lib/types/pm-schedule'
import 'react-big-calendar/lib/css/react-big-calendar.css'

// ─── date-fns Localizer ───────────────────────────────────────────────────────

const locales = { 'en-US': enUS }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
})

// ─── Auth Headers ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

// ─── PmCalendarView ───────────────────────────────────────────────────────────

interface PmCalendarViewProps {
  onEventClick?: (event: PmCalendarEventType) => void
}

// react-big-calendar expects event objects with `start` and `end` as Date
interface CalendarEventWithDates extends Omit<PmCalendarEventType, 'start' | 'end'> {
  start: Date
  end: Date
  resource?: PmCalendarEventType
}

export default function PmCalendarView({ onEventClick }: PmCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<'month' | 'week'>('month')

  // Compute date range for the current calendar view
  const dateRange = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    // Pad by one month on each side to cover calendar week overflows
    return {
      start: subMonths(monthStart, 0).toISOString(),
      end: addMonths(monthEnd, 0).toISOString(),
    }
  }, [currentDate])

  const { data: events = [], isLoading } = useQuery<PmCalendarEventType[]>({
    queryKey: ['pm-calendar-events', dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: 'calendar',
        start: dateRange.start,
        end: dateRange.end,
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

  // Convert string dates to Date objects for react-big-calendar
  const calendarEvents: CalendarEventWithDates[] = useMemo(() => {
    return events.map((e) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
      resource: e,
    }))
  }, [events])

  const handleSelectEvent = useCallback(
    (event: CalendarEventWithDates) => {
      if (onEventClick && event.resource) {
        onEventClick(event.resource)
      }
    },
    [onEventClick]
  )

  const handleNavigate = (date: Date) => {
    setCurrentDate(date)
  }

  // Custom event renderer
  const eventPropGetter = useCallback((event: CalendarEventWithDates) => {
    const colorMap: Record<string, string> = {
      blue: '#3b82f6',
      red: '#ef4444',
      green: '#22c55e',
    }
    return {
      style: {
        backgroundColor: colorMap[event.color] || colorMap.blue,
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        fontSize: '11px',
      },
    }
  }, [])

  const CustomEvent = useCallback(
    ({ event }: { event: CalendarEventWithDates }) => {
      return <PmCalendarEvent event={event.resource || (event as unknown as PmCalendarEventType)} />
    },
    []
  )

  return (
    <div className="space-y-4">
      {/* Calendar toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate((d) => subMonths(d, 1))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate((d) => addMonths(d, 1))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 ml-2">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setCurrentView('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              currentView === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Month
          </button>
          <button
            onClick={() => setCurrentView('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              currentView === 'week'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutList className="w-4 h-4" />
            Week
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
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

      {/* Calendar */}
      {isLoading ? (
        <div className="ui-glass p-8 animate-pulse">
          <div className="h-96 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="ui-glass overflow-hidden pm-calendar-wrapper"
        >
          <style>{`
            .pm-calendar-wrapper .rbc-calendar {
              font-family: inherit;
              background: transparent;
            }
            .pm-calendar-wrapper .rbc-header {
              padding: 8px 4px;
              font-size: 12px;
              font-weight: 600;
              color: #6b7280;
              border-color: #f3f4f6;
            }
            .pm-calendar-wrapper .rbc-month-view {
              border-color: #f3f4f6;
              border-radius: 0;
            }
            .pm-calendar-wrapper .rbc-day-bg {
              border-color: #f3f4f6;
            }
            .pm-calendar-wrapper .rbc-today {
              background-color: #ecfdf5;
            }
            .pm-calendar-wrapper .rbc-off-range-bg {
              background-color: #fafafa;
            }
            .pm-calendar-wrapper .rbc-toolbar {
              display: none;
            }
            .pm-calendar-wrapper .rbc-event {
              border-radius: 4px;
              font-size: 11px;
              padding: 0;
            }
            .pm-calendar-wrapper .rbc-event:focus {
              outline: none;
            }
            .pm-calendar-wrapper .rbc-date-cell {
              font-size: 12px;
              color: #374151;
              padding: 4px 8px;
            }
            .pm-calendar-wrapper .rbc-date-cell.rbc-now {
              font-weight: 700;
              color: #059669;
            }
          `}</style>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view={currentView}
            onView={(v) => setCurrentView(v as 'month' | 'week')}
            date={currentDate}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
            components={{ event: CustomEvent as any }}
            style={{ height: 560 }}
            views={[Views.MONTH, Views.WEEK]}
            popup
          />
        </motion.div>
      )}
    </div>
  )
}
