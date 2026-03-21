'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { AddEventTeamMemberInput, UpdateEventTeamMemberInput } from '@/lib/types/event-project'

export interface EventTeamMember {
  id: string
  eventProjectId: string
  userId: string
  role: string
  notes: string | null
  addedById: string
  createdAt: string
  updatedAt: string
  // Per-member event permissions
  canManageTasks: boolean
  canManageSchedule: boolean
  canViewBudget: boolean
  canManageLogistics: boolean
  canManageCheckin: boolean
  canSendComms: boolean
  canViewRegistrations: boolean
  canManageDocuments: boolean
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
    jobTitle: string | null
  }
  addedBy: {
    id: string
    firstName: string | null
    lastName: string | null
  }
}

/**
 * Fetch all team members for an event project.
 */
export function useEventTeam(eventProjectId: string | null | undefined) {
  return useQuery<EventTeamMember[]>({
    queryKey: ['event-team', eventProjectId],
    queryFn: () =>
      fetchApi<EventTeamMember[]>(`/api/events/projects/${eventProjectId}/team`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Add a user to the event team.
 */
export function useAddTeamMember(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddEventTeamMemberInput) =>
      fetchApi<EventTeamMember>(`/api/events/projects/${eventProjectId}/team`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-team', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Add multiple users to the event team sequentially.
 * Returns { added, errors } so partial success is visible.
 */
export function useAddTeamMembersBatch(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (items: AddEventTeamMemberInput[]) => {
      const added: EventTeamMember[] = []
      const errors: Array<{ userId: string; message: string }> = []

      for (const item of items) {
        try {
          const member = await fetchApi<EventTeamMember>(
            `/api/events/projects/${eventProjectId}/team`,
            { method: 'POST', body: JSON.stringify(item) },
          )
          added.push(member)
        } catch (err) {
          errors.push({
            userId: item.userId,
            message: err instanceof Error ? err.message : 'Failed to add',
          })
        }
      }
      return { added, errors }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-team', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Update a team member's role or notes.
 */
export function useUpdateTeamMember(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      memberId,
      ...data
    }: UpdateEventTeamMemberInput & { memberId: string }) =>
      fetchApi<EventTeamMember>(
        `/api/events/projects/${eventProjectId}/team/${memberId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-team', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Remove a team member.
 */
export function useRemoveTeamMember(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      fetchApi<{ deleted: boolean }>(
        `/api/events/projects/${eventProjectId}/team/${memberId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-team', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}
