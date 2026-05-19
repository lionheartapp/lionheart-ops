'use client'

import { Calendar, ExternalLink, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface BookingMetadata {
  type: 'booking-conflict'
  booking: {
    title: string
    spaceName: string
    date: string // YYYY-MM-DD
    startTime: string // HH:mm
    endTime: string // HH:mm
    calendarEventId: string
    sourceModule: string
  }
}

interface BookingReferenceCardProps {
  metadata: BookingMetadata
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00') // Avoid timezone shift
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * Rich card rendered inside a message bubble when the message has
 * metadata.type === 'booking-conflict'. Shows the booking details
 * with a link to view it on the calendar.
 *
 * Graceful degradation: if the underlying CalendarEvent has been
 * cancelled or deleted, shows the original snapshot from metadata
 * with a status badge.
 */
export default function BookingReferenceCard({ metadata }: BookingReferenceCardProps) {
  const { booking } = metadata
  const eventId = booking.calendarEventId

  // Check if the event still exists (lightweight query)
  const { data: eventStatus } = useQuery({
    queryKey: ['calendar-event-status', eventId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/calendar/events/${eventId}/status`)
        if (!res.ok) return { exists: false, cancelled: false }
        const json = await res.json()
        if (!json.ok) return { exists: false, cancelled: false }
        return {
          exists: true,
          cancelled: json.data?.calendarStatus === 'CANCELLED',
        }
      } catch {
        return { exists: false, cancelled: false }
      }
    },
    staleTime: 5 * 60_000, // 5 min cache
    retry: false,
  })

  const isCancelled = eventStatus?.cancelled === true
  const isDeleted = eventStatus?.exists === false

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4 my-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          Booking Request
        </span>
        {isCancelled && (
          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
            Cancelled
          </span>
        )}
        {isDeleted && (
          <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
            No longer exists
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-blue-200/30 mb-2" />

      {/* Details (always from snapshot metadata) */}
      <p className="text-sm font-medium text-slate-800">{booking.title}</p>
      <p className="text-xs text-slate-600 mt-0.5">{booking.spaceName}</p>
      <p className="text-xs text-slate-500 mt-0.5">
        {formatDisplayDate(booking.date)} &middot; {formatDisplayTime(booking.startTime)} &ndash; {formatDisplayTime(booking.endTime)}
      </p>

      {/* View on Calendar link */}
      {!isDeleted && (
        <a
          href={`/calendar?date=${booking.date}&eventId=${eventId}`}
          className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
        >
          View on Calendar
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {isDeleted && (
        <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-400">
          <AlertCircle className="w-3 h-3" />
          This booking no longer exists
        </div>
      )}
    </div>
  )
}
