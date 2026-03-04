'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

export function useAthleticsCalendarEvents(
  campusIds: string[],
  start: string,
  end: string,
  enabled: boolean,
) {
  return useQuery({
    ...queryOptions.athleticsCalendarEvents(campusIds, start, end),
    enabled: enabled && campusIds.length > 0,
    placeholderData: keepPreviousData,
    select: (data) => data as unknown as CalendarEventData[],
  })
}

export function useAthleticsSports(enabled: boolean) {
  return useQuery({
    ...queryOptions.athleticsSports(),
    enabled,
    select: (data) => data as Array<{
      id: string
      name: string
      color: string
      abbreviation?: string
      seasonType?: string
    }>,
  })
}
