import type { CalendarEventData } from '@/lib/hooks/useCalendar'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'

export interface SubColumnConfig {
  personId: string | null // null = "You" (self) column
  label: string
  initials: string
  color: string
  events: CalendarEventData[]
  columnIndex: number
  totalColumns: number
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Compute sub-column configurations for a single day when "Meet with" is active.
 * Column 0 = "You" (user's own events), Columns 1–N = each selected person's events.
 */
export function computeSubColumns(
  selfEvents: CalendarEventData[],
  meetWithPeople: MeetWithPerson[],
  meetWithEvents: Map<string, CalendarEventData[]>,
  dayDate: Date
): SubColumnConfig[] {
  if (meetWithPeople.length === 0) return []

  const totalColumns = meetWithPeople.length + 1

  const filterByDay = (events: CalendarEventData[]) =>
    events.filter((e) => {
      if (e.isAllDay) return false
      const start = new Date(e.startTime)
      return isSameDay(start, dayDate)
    })

  const columns: SubColumnConfig[] = [
    {
      personId: null,
      label: 'You',
      initials: 'You',
      color: '#6b7280',
      events: filterByDay(selfEvents),
      columnIndex: 0,
      totalColumns,
    },
  ]

  meetWithPeople.forEach((person, i) => {
    const personEvents = meetWithEvents.get(person.id) || []
    const firstName = person.firstName || person.email.split('@')[0]
    const initials = person.firstName
      ? `${person.firstName[0]}${person.lastName?.[0] || ''}`.toUpperCase()
      : person.email[0].toUpperCase()

    columns.push({
      personId: person.id,
      label: firstName,
      initials,
      color: person.color,
      events: filterByDay(personEvents),
      columnIndex: i + 1,
      totalColumns,
    })
  })

  return columns
}

/**
 * Get CSS style for positioning an event within a sub-column.
 */
export function getSubColumnStyle(
  columnIndex: number,
  totalColumns: number
): { left: string; width: string } {
  const widthPct = 100 / totalColumns
  const leftPct = columnIndex * widthPct
  return {
    left: `${leftPct}%`,
    width: `${widthPct}%`,
  }
}
