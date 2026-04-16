'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

/**
 * Fetches the current user's external (Google/Microsoft) calendar events that
 * overlap the requested time window. Already shaped as `CalendarEventData` by
 * the API so the calendar grid can merge it straight in.
 *
 * Pass `enabled=false` to suppress the request (e.g. the user has disabled
 * external events in their calendar filters).
 */
export function useExternalCalendarEvents(
  start: string,
  end: string,
  enabled: boolean,
) {
  return useQuery({
    ...queryOptions.externalCalendarEvents(start, end),
    enabled,
    placeholderData: keepPreviousData,
    select: (data) => data as unknown as CalendarEventData[],
  })
}
