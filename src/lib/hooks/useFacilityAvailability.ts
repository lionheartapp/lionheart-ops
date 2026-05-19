'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import type { AvailabilityResult, BulkCheckResult } from '@/lib/services/facilityBookingService'

interface ApiResponse<T> {
  ok: boolean
  data: T
  error?: { code: string; message: string }
}

/**
 * Check availability for a single time slot at a space.
 * Auto-refetches when spaceId, startTime, or endTime change.
 */
export function useFacilityAvailability(opts: {
  spaceId: string | null
  startTime: string | null // ISO string
  endTime: string | null // ISO string
  setupMinutes?: number
  teardownMinutes?: number
  excludeEventId?: string
  enabled?: boolean
}) {
  const { spaceId, startTime, endTime, setupMinutes, teardownMinutes, excludeEventId } = opts

  return useQuery<AvailabilityResult>({
    queryKey: ['facility-availability', spaceId, startTime, endTime, setupMinutes, teardownMinutes, excludeEventId],
    queryFn: async () => {
      const params = new URLSearchParams({
        spaceId: spaceId!,
        startTime: startTime!,
        endTime: endTime!,
      })
      if (setupMinutes != null) params.set('setupMinutes', String(setupMinutes))
      if (teardownMinutes != null) params.set('teardownMinutes', String(teardownMinutes))
      if (excludeEventId) params.set('excludeEventId', excludeEventId)

      const res = await fetch(`/api/facilities/availability?${params}`)
      const json: ApiResponse<AvailabilityResult> = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to check availability')
      return json.data
    },
    enabled: (opts.enabled ?? true) && !!spaceId && !!startTime && !!endTime,
    staleTime: 30_000, // 30 seconds — availability can change
  })
}

/**
 * Bulk check availability for multiple time slots (recurring bookings).
 */
export function useBulkAvailabilityCheck() {
  return useMutation<
    { results: BulkCheckResult[] },
    Error,
    {
      spaceId: string
      slots: Array<{ startTime: string; endTime: string }>
      setupMinutes?: number
      teardownMinutes?: number
      excludeEventId?: string
    }
  >({
    mutationFn: async (body) => {
      const res = await fetch('/api/facilities/check-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json: ApiResponse<{ results: BulkCheckResult[] }> = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to check bulk availability')
      return json.data
    },
  })
}

/**
 * Get a space's schedule for a date range.
 */
export function useSpaceSchedule(opts: {
  spaceId: string | null
  start: string | null // ISO string
  end: string | null // ISO string
  enabled?: boolean
}) {
  return useQuery({
    queryKey: ['space-schedule', opts.spaceId, opts.start, opts.end],
    queryFn: async () => {
      const params = new URLSearchParams({
        spaceId: opts.spaceId!,
        start: opts.start!,
        end: opts.end!,
      })

      const res = await fetch(`/api/facilities/space-schedule?${params}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load schedule')
      return json.data
    },
    enabled: (opts.enabled ?? true) && !!opts.spaceId && !!opts.start && !!opts.end,
    staleTime: 60_000, // 1 minute
  })
}
