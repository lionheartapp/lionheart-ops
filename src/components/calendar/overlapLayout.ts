import type { CalendarEventData } from '@/lib/hooks/useCalendar'

/**
 * Google Calendar-style overlap layout algorithm.
 *
 * 1. Sort events by start time, then by duration (longest first).
 * 2. Group overlapping events into collision clusters.
 * 3. Assign each event a column index using greedy first-fit.
 * 4. Calculate left% and width% so events sit side-by-side.
 */

export interface EventLayout {
  event: CalendarEventData
  /** Column index within the collision group (0-based) */
  column: number
  /** Total columns in this collision group */
  totalColumns: number
}

export interface EventLayoutStyle {
  left: string
  width: string
}

/**
 * Compute column assignments for a list of timed events on a single day.
 */
export function layoutEvents(events: CalendarEventData[]): Map<string, EventLayout> {
  if (events.length === 0) return new Map()

  // Sort: earliest start first, then longest duration first (so wider events get first column)
  const sorted = [...events].sort((a, b) => {
    const aStart = new Date(a.startTime).getTime()
    const bStart = new Date(b.startTime).getTime()
    if (aStart !== bStart) return aStart - bStart
    const aDur = new Date(a.endTime).getTime() - aStart
    const bDur = new Date(b.endTime).getTime() - bStart
    return bDur - aDur // longer events first
  })

  // Build collision groups — events that transitively overlap
  const groups: CalendarEventData[][] = []
  let currentGroup: CalendarEventData[] = []
  let groupEnd = 0

  for (const event of sorted) {
    const start = new Date(event.startTime).getTime()
    const end = new Date(event.endTime).getTime()

    if (currentGroup.length === 0 || start < groupEnd) {
      // Overlaps with current group
      currentGroup.push(event)
      groupEnd = Math.max(groupEnd, end)
    } else {
      // No overlap — flush previous group, start new one
      groups.push(currentGroup)
      currentGroup = [event]
      groupEnd = end
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  // Assign columns within each group using greedy first-fit
  const result = new Map<string, EventLayout>()

  for (const group of groups) {
    // columnEnds[i] = end time of the last event placed in column i
    const columnEnds: number[] = []

    for (const event of group) {
      const start = new Date(event.startTime).getTime()

      // Find the first column where this event fits (no overlap)
      let col = -1
      for (let i = 0; i < columnEnds.length; i++) {
        if (start >= columnEnds[i]) {
          col = i
          break
        }
      }

      if (col === -1) {
        // Need a new column
        col = columnEnds.length
        columnEnds.push(0)
      }

      columnEnds[col] = new Date(event.endTime).getTime()

      result.set(event.id, {
        event,
        column: col,
        totalColumns: 0, // will be set after all events are placed
      })
    }

    // Set totalColumns for all events in this group
    const totalColumns = columnEnds.length
    for (const event of group) {
      const layout = result.get(event.id)!
      layout.totalColumns = totalColumns
    }
  }

  return result
}

/**
 * Convert an EventLayout into CSS left/width values.
 * Adds a small gap between columns.
 */
export function getOverlapStyle(layout: EventLayout): EventLayoutStyle {
  if (layout.totalColumns <= 1) {
    return { left: '4px', width: 'calc(100% - 8px)' }
  }

  const GAP = 2 // px gap between columns
  const colWidth = `calc((100% - ${GAP * (layout.totalColumns - 1) + 8}px) / ${layout.totalColumns})`
  const colLeft = `calc(4px + ${layout.column} * ((100% - ${GAP * (layout.totalColumns - 1) + 8}px) / ${layout.totalColumns} + ${GAP}px))`

  return { left: colLeft, width: colWidth }
}
