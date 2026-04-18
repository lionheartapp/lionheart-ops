import { useState, useMemo, useEffect } from 'react'
import { useAthleticsCalendarEvents, useAthleticsSports } from '@/lib/hooks/useAthleticsCalendar'
import {
  getEventMetadata,
  type CalendarData,
  type CalendarEventData,
  type EventMetadata,
} from '@/lib/hooks/useCalendar'
import type { CalendarFilter } from '@/components/calendar/CalendarFilterPopover'

interface UseAthleticsOverlayParams {
  calendars: CalendarData[]
  start: Date
  end: Date
  calendarFilter: CalendarFilter
}

export function useAthleticsOverlay({
  calendars,
  start,
  end,
  calendarFilter,
}: UseAthleticsOverlayParams) {
  const [visibleAthleticsCampusIds, setVisibleAthleticsCampusIds] = useState<Set<string>>(new Set())

  // Listen for athletics-calendar-toggle from Sidebar
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const event = e as CustomEvent<{ campusId: string; visible: boolean }>
      if (event.detail?.campusId) {
        setVisibleAthleticsCampusIds((prev) => {
          const next = new Set(prev)
          if (event.detail.visible) next.add(event.detail.campusId)
          else next.delete(event.detail.campusId)
          return next
        })
      }
    }
    window.addEventListener('athletics-calendar-toggle', handleToggle)
    return () => window.removeEventListener('athletics-calendar-toggle', handleToggle)
  }, [])

  const athleticsCampusArray = useMemo(() => Array.from(visibleAthleticsCampusIds), [visibleAthleticsCampusIds])
  const anyAthleticsVisible = athleticsCampusArray.length > 0

  const { data: athleticsEvents = [] } = useAthleticsCalendarEvents(
    athleticsCampusArray,
    start.toISOString(),
    end.toISOString(),
    anyAthleticsVisible,
  )
  const { data: athleticsSports = [] } = useAthleticsSports(anyAthleticsVisible)

  // Build unique campus list from calendars that have campus info
  const athleticsCampuses: Array<{ id: string; name: string }> = useMemo(() => {
    if (!anyAthleticsVisible) return []
    const seen = new Map<string, string>()
    for (const cal of calendars) {
      const campus = cal.campus as { id: string; name: string } | null | undefined
      if (campus && visibleAthleticsCampusIds.has(campus.id) && !seen.has(campus.id)) {
        seen.set(campus.id, campus.name)
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
  }, [calendars, visibleAthleticsCampusIds, anyAthleticsVisible])

  // Apply athletics filters
  const filteredAthleticsEvents: CalendarEventData[] = useMemo(() => {
    if (!anyAthleticsVisible) return []
    let result = athleticsEvents
    const { campusIds, schoolLevels, sportIds, teamLevels } = calendarFilter
    if (campusIds.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        return meta?.campusId && campusIds.has(meta.campusId)
      })
    }
    if (schoolLevels.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        // Map gradeLevel values to display labels
        const level = meta?.schoolLevel || meta?.teamLevel
        return level && schoolLevels.has(level)
      })
    }
    if (sportIds.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        return meta?.sportId && sportIds.has(meta.sportId)
      })
    }
    if (teamLevels.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        return meta?.teamLevel && teamLevels.has(meta.teamLevel)
      })
    }
    return result
  }, [athleticsEvents, calendarFilter, anyAthleticsVisible])

  return {
    anyAthleticsVisible,
    filteredAthleticsEvents,
    athleticsCampuses,
    athleticsSports,
    athleticsCampusArray,
    visibleAthleticsCampusIds,
    setVisibleAthleticsCampusIds,
  }
}
