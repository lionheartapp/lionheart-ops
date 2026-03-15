'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { CreateEventTaskInput, UpdateEventTaskInput } from '@/lib/types/event-project'
import type { EventTask } from './useEventProject'

// ─── Types ─────────────────────────────────────────────────────────────

export interface EventTaskFilters {
  status?: string
  assigneeId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────

function buildQueryString(filters?: EventTaskFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Hooks ─────────────────────────────────────────────────────────────

/**
 * Fetch all tasks for an event project with optional status/assigneeId filters.
 */
export function useEventTasks(
  eventProjectId: string | null | undefined,
  filters?: EventTaskFilters
) {
  const qs = buildQueryString(filters)
  return useQuery<EventTask[]>({
    queryKey: ['event-tasks', eventProjectId, filters],
    queryFn: () => fetchApi<EventTask[]>(`/api/events/projects/${eventProjectId}/tasks${qs}`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Create a new task for an event project.
 * Invalidates tasks and activity queries on success.
 */
export function useCreateEventTask(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventTaskInput) =>
      fetchApi<EventTask>(`/api/events/projects/${eventProjectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-tasks', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Update an existing task (partial update).
 * Invalidates tasks and activity queries on success.
 */
export function useUpdateEventTask(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateEventTaskInput }) =>
      fetchApi<EventTask>(`/api/events/projects/${eventProjectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-tasks', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Delete a task (hard delete).
 * Invalidates tasks and activity queries on success.
 */
export function useDeleteEventTask(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      fetchApi<void>(`/api/events/projects/${eventProjectId}/tasks/${taskId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-tasks', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}
