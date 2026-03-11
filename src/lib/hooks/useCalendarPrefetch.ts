'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { computeDateRange, type CalendarViewType } from './useCalendar'
import { queryOptions } from '@/lib/queries'

/**
 * Prefetches adjacent time ranges so navigating forward/backward feels instant.
 * Uses a 300ms delay to avoid firing during rapid navigation.
 *
 * When athleticsCampusIds are provided, also prefetches athletics calendar events
 * for adjacent ranges so the athletics panel doesn't block on navigation.
 */
export function useCalendarPrefetch(
  currentDate: Date,
  view: CalendarViewType,
  enabled = true,
  athleticsCampusIds: string[] = []
) {
  const queryClient = useQueryClient()
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!enabled) return

    // Clear any pending prefetch from previous render
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      const offsets = getAdjacentOffsets(view)

      for (const offset of offsets) {
        const adjacentDate = new Date(currentDate)
        if (view === 'month') {
          adjacentDate.setMonth(adjacentDate.getMonth() + offset)
        } else if (view === 'week') {
          adjacentDate.setDate(adjacentDate.getDate() + offset * 7)
        } else {
          adjacentDate.setDate(adjacentDate.getDate() + offset)
        }

        const { start, end } = computeDateRange(adjacentDate, view)

        // Prefetch regular calendar events
        queryClient.prefetchQuery(
          queryOptions.calendarEvents(
            [],
            start.toISOString(),
            end.toISOString()
          )
        )

        // Prefetch athletics calendar events if athletics is visible
        if (athleticsCampusIds.length > 0) {
          queryClient.prefetchQuery(
            queryOptions.athleticsCalendarEvents(
              athleticsCampusIds,
              start.toISOString(),
              end.toISOString()
            )
          )
        }
      }
    }, 300)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [currentDate, view, enabled, athleticsCampusIds, queryClient])
}

function getAdjacentOffsets(view: CalendarViewType): number[] {
  // Prefetch previous and next range
  return [-1, 1]
}
