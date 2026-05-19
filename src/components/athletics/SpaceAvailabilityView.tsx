'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react'
import { useSpaceSchedule } from '@/lib/hooks/useFacilityAvailability'

interface SpaceAvailabilityViewProps {
  spaceId: string | null
  spaceName?: string
  onSpaceChange?: (spaceId: string) => void
}

function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function formatDayHeader(date: Date): { day: string; dateNum: string } {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  const dateNum = String(date.getDate())
  return { day, dateNum }
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

function isToday(date: Date): boolean {
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  athletics: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'event-project': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  maintenance: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  default: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
}

export default function SpaceAvailabilityView({
  spaceId,
}: SpaceAvailabilityViewProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  const baseDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])

  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate])

  const startISO = weekDays[0].toISOString()
  const endDate = new Date(weekDays[6])
  endDate.setHours(23, 59, 59, 999)
  const endISO = endDate.toISOString()

  const { data, isLoading } = useSpaceSchedule({
    spaceId,
    start: startISO,
    end: endISO,
  })

  // Group bookings by day
  const bookingsByDay = useMemo(() => {
    if (!data?.bookings) return new Map<string, typeof data.bookings>()
    const map = new Map<string, typeof data.bookings>()
    for (const booking of data.bookings) {
      const dateKey = new Date(booking.startTime).toDateString()
      const existing = map.get(dateKey) ?? []
      existing.push(booking)
      map.set(dateKey, existing)
    }
    return map
  }, [data?.bookings])

  if (!spaceId) {
    return (
      <div className="ui-glass p-6 text-center">
        <p className="text-sm text-slate-400">Select a space to view its schedule</p>
      </div>
    )
  }

  const weekLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(weekDays[0])
    + ' – '
    + new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(weekDays[6])

  return (
    <div className="ui-glass p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {data?.space?.name ?? 'Space Schedule'}
          </h3>
          {data?.space?.status === 'UNDER_MAINTENANCE' && (
            <div className="flex items-center gap-1 mt-0.5">
              <Wrench className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600">Under Maintenance</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-xs font-medium text-slate-600 min-w-[120px] text-center">
            {weekLabel}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Week grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-[560px] sm:min-w-0">
          {weekDays.map((day) => {
            const { day: dayName, dateNum } = formatDayHeader(day)
            const dayBookings = bookingsByDay.get(day.toDateString()) ?? []
            const today = isToday(day)

            return (
              <div key={day.toISOString()} className="min-h-[100px]">
                {/* Day header */}
                <div className={`text-center pb-1.5 mb-1.5 border-b ${today ? 'border-indigo-200' : 'border-slate-100'}`}>
                  <p className={`text-[10px] font-medium ${today ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {dayName}
                  </p>
                  <p className={`text-sm font-semibold ${today ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {dateNum}
                  </p>
                </div>

                {/* Bookings */}
                <div className="space-y-1">
                  {dayBookings.length === 0 && (
                    <p className="text-[10px] text-slate-300 text-center py-2">Open</p>
                  )}
                  {dayBookings.map((booking: { id: string; title: string; startTime: Date; endTime: Date; sourceModule: string | null }) => {
                    const colors = SOURCE_COLORS[booking.sourceModule ?? ''] ?? SOURCE_COLORS.default
                    return (
                      <div
                        key={booking.id}
                        className={`${colors.bg} ${colors.border} border rounded-md px-1.5 py-1 cursor-pointer hover:shadow-sm transition-shadow`}
                        title={`${booking.title}\n${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`}
                      >
                        <p className={`text-[10px] font-medium ${colors.text} truncate`}>
                          {booking.title}
                        </p>
                        <p className={`text-[9px] ${colors.text} opacity-70`}>
                          {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-200" />
          <span className="text-[10px] text-slate-500">Athletics</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-indigo-100" />
          <span className="text-[10px] text-slate-500">Event</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-200" />
          <span className="text-[10px] text-slate-500">Blocked</span>
        </div>
      </div>
    </div>
  )
}
