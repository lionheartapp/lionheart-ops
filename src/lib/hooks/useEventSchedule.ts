'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { CreateScheduleBlockInput, UpdateScheduleBlockInput } from '@/lib/types/event-project'
import type { EventScheduleBlock } from './useEventProject'

// ─── Hooks ─────────────────────────────────────────────────────────────

/**
 * Fetch all schedule blocks for an event project.
 * Returns blocks sorted by startsAt (server-side ordering).
 */
export function useScheduleBlocks(eventProjectId: string | null | undefined) {
  return useQuery<EventScheduleBlock[]>({
    queryKey: ['event-schedule', eventProjectId],
    queryFn: () => fetchApi<EventScheduleBlock[]>(`/api/events/projects/${eventProjectId}/schedule`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Create a new schedule block for an event project.
 * Invalidates schedule and activity queries on success.
 */
export function useCreateScheduleBlock(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateScheduleBlockInput) =>
      fetchApi<EventScheduleBlock>(`/api/events/projects/${eventProjectId}/schedule`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Update an existing schedule block (partial update).
 * Invalidates schedule and activity queries on success.
 */
export function useUpdateScheduleBlock(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ blockId, data }: { blockId: string; data: UpdateScheduleBlockInput }) =>
      fetchApi<EventScheduleBlock>(`/api/events/projects/${eventProjectId}/schedule/${blockId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Delete a schedule block (hard delete).
 * Invalidates schedule and activity queries on success.
 */
export function useDeleteScheduleBlock(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (blockId: string) =>
      fetchApi<void>(`/api/events/projects/${eventProjectId}/schedule/${blockId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}
