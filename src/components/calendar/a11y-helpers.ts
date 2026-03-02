import type { CalendarEventData } from '@/lib/hooks/useCalendar'

function formatTimeForAria(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function getEventAriaLabel(event: CalendarEventData): string {
  const parts: string[] = [event.title]

  if (event.isAllDay) {
    const d = new Date(event.startTime)
    parts.push(d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))
    parts.push('All day')
  } else {
    parts.push(`${formatTimeForAria(event.startTime)} to ${formatTimeForAria(event.endTime)}`)
  }

  parts.push(event.calendar.name)

  if (event.locationText) {
    parts.push(`at ${event.locationText}`)
  } else if (event.building) {
    parts.push(`at ${event.building.name}${event.area ? ` ${event.area.name}` : ''}`)
  }

  return parts.join(', ')
}
