'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export type MyTaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

export interface MyTask {
  id: string
  title: string
  description: string | null
  status: MyTaskStatus
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  category: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  eventProject: {
    id: string
    title: string
    startsAt: string | null
    endsAt: string | null
    status: string
    building: { id: string; name: string } | null
    room: { id: string; displayName: string | null; roomNumber: string | null } | null
  }
  createdBy: {
    id: string
    firstName: string | null
    lastName: string | null
  } | null
}

/**
 * All tasks across the org where the current user is the assignee.
 * Powers the My Tasks inbox.
 */
export function useMyTasks(filters?: { status?: MyTaskStatus }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  const qs = params.toString()
  const url = qs ? `/api/me/tasks?${qs}` : '/api/me/tasks'

  return useQuery<MyTask[]>({
    queryKey: ['my-tasks', filters ?? {}],
    queryFn: () => fetchApi<MyTask[]>(url),
    staleTime: 60_000,
  })
}

/**
 * Update the status of a task assigned to the current user.
 *
 * The PATCH endpoint accepts assignee-only updates with status alone, so this
 * works even if the user isn't on the event team.
 */
export function useUpdateMyTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventProjectId,
      taskId,
      status,
    }: {
      eventProjectId: string
      taskId: string
      status: MyTaskStatus
    }) =>
      fetchApi<MyTask>(`/api/events/projects/${eventProjectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    },
  })
}

// ─── Personal Tasks ──────────────────────────────────────────────────────────

export interface PersonalTask {
  id: string
  title: string
  description: string | null
  status: MyTaskStatus
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

export function usePersonalTasks(filters?: { status?: MyTaskStatus }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  const qs = params.toString()
  const url = qs ? `/api/me/tasks/personal?${qs}` : '/api/me/tasks/personal'

  return useQuery<PersonalTask[]>({
    queryKey: ['personal-tasks', filters ?? {}],
    queryFn: () => fetchApi<PersonalTask[]>(url),
    staleTime: 60_000,
  })
}

export function useCreatePersonalTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description?: string; priority?: string; dueDate?: string }) =>
      fetchApi<PersonalTask>('/api/me/tasks/personal', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tasks'] })
    },
  })
}

export function useUpdatePersonalTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, ...data }: { taskId: string; title?: string; description?: string | null; status?: MyTaskStatus; priority?: string; dueDate?: string | null }) =>
      fetchApi<PersonalTask>(`/api/me/tasks/personal/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tasks'] })
    },
  })
}

export function useDeletePersonalTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      fetchApi(`/api/me/tasks/personal/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tasks'] })
    },
  })
}
