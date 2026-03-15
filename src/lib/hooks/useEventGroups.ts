'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EventGroupType = 'BUS' | 'CABIN' | 'SMALL_GROUP'

export interface EventGroup {
  id: string
  eventProjectId: string
  type: EventGroupType
  name: string
  capacity: number | null
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  leader?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
  } | null
  _count?: {
    assignments: number
  }
  assignmentCount: number
}

export interface GroupParticipant {
  registrationId: string
  firstName: string
  lastName: string
  email: string
  grade: string | null
  photoUrl: string | null
  hasMedicalFlags: boolean
  assignedAt?: string
}

export interface GroupAssignmentsData {
  assignments: GroupParticipant[]
  unassigned: GroupParticipant[]
  capacity: number | null
}

export interface EventActivity {
  id: string
  eventProjectId: string
  name: string
  description: string | null
  capacity: number | null
  scheduledAt: string | null
  location: string | null
  createdAt: string
  updatedAt: string
  signupCount: number
  isFull: boolean
}

export interface ActivitySignup {
  id: string
  registrationId: string
  activityId: string
  signedUpAt: string
  participant: GroupParticipant
}

export interface DietarySummaryItem {
  need: string
  count: number
}

export interface AllergySummaryItem {
  allergy: string
  count: number
  participantNames: string[]
}

export interface DietaryMedicalReport {
  dietarySummary: DietarySummaryItem[]
  allergySummary: AllergySummaryItem[]
  medicationCount: number
  participantsWithMedicalNotes: string[]
}

// ─── Group Query Keys ───────────────────────────────────────────────────────────

function groupsKey(eventProjectId: string, type?: EventGroupType) {
  return type
    ? ['event-groups', eventProjectId, type]
    : ['event-groups', eventProjectId]
}

function assignmentsKey(groupId: string) {
  return ['event-group-assignments', groupId]
}

function activitiesKey(eventProjectId: string) {
  return ['event-activities', eventProjectId]
}

function dietaryMedicalKey(eventProjectId: string) {
  return ['event-dietary-medical', eventProjectId]
}

// ─── Group Hooks ────────────────────────────────────────────────────────────────

/** Fetch all groups for an event project, optionally filtered by type. */
export function useGroups(eventProjectId: string | null | undefined, type?: EventGroupType) {
  const qs = type ? `?type=${type}` : ''
  return useQuery<EventGroup[]>({
    queryKey: groupsKey(eventProjectId ?? '', type),
    queryFn: () =>
      fetchApi<EventGroup[]>(`/api/events/projects/${eventProjectId}/groups${qs}`),
    enabled: !!eventProjectId,
    staleTime: 30_000,
  })
}

/** Fetch assignments and unassigned pool for a specific group. */
export function useGroupAssignments(
  eventProjectId: string | null | undefined,
  groupId: string | null | undefined
) {
  return useQuery<GroupAssignmentsData>({
    queryKey: assignmentsKey(groupId ?? ''),
    queryFn: () =>
      fetchApi<GroupAssignmentsData>(
        `/api/events/projects/${eventProjectId}/groups/${groupId}/assignments`
      ),
    enabled: !!eventProjectId && !!groupId,
    staleTime: 15_000,
  })
}

/** Assign a participant to a group. */
export function useAssignToGroup(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      groupId,
      registrationId,
    }: {
      groupId: string
      registrationId: string
    }) =>
      fetchApi(`/api/events/projects/${eventProjectId}/groups/${groupId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ registrationId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupsKey(eventProjectId) })
      queryClient.invalidateQueries({
        queryKey: assignmentsKey(variables.groupId),
      })
    },
  })
}

/** Remove a participant from a group. */
export function useRemoveFromGroup(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      groupId,
      registrationId,
    }: {
      groupId: string
      registrationId: string
    }) =>
      fetchApi(`/api/events/projects/${eventProjectId}/groups/${groupId}/assignments`, {
        method: 'DELETE',
        body: JSON.stringify({ registrationId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupsKey(eventProjectId) })
      queryClient.invalidateQueries({
        queryKey: assignmentsKey(variables.groupId),
      })
    },
  })
}

/** Auto-assign all unassigned participants to groups of the given type. */
export function useAutoAssign(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      groupType,
      balanceBy,
    }: {
      groupType: EventGroupType
      balanceBy?: 'grade' | 'gender'
    }) =>
      fetchApi<{ assignmentsCreated: number }>(
        `/api/events/projects/${eventProjectId}/groups/auto-assign`,
        {
          method: 'POST',
          body: JSON.stringify({ groupType, balanceBy }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey(eventProjectId) })
    },
  })
}

/** Create a new group. */
export function useCreateGroup(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      type: EventGroupType
      name: string
      capacity?: number
      leaderId?: string
      description?: string
    }) =>
      fetchApi<EventGroup>(`/api/events/projects/${eventProjectId}/groups`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey(eventProjectId) })
    },
  })
}

/** Update an existing group. */
export function useUpdateGroup(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      groupId: string
      name?: string
      capacity?: number
      leaderId?: string
      description?: string
    }) =>
      fetchApi<EventGroup>(`/api/events/projects/${eventProjectId}/groups`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey(eventProjectId) })
    },
  })
}

/** Delete a group. */
export function useDeleteGroup(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) =>
      fetchApi(`/api/events/projects/${eventProjectId}/groups`, {
        method: 'DELETE',
        body: JSON.stringify({ groupId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey(eventProjectId) })
    },
  })
}

// ─── Activity Hooks ─────────────────────────────────────────────────────────────

/** Fetch all activities for an event project with signup counts. */
export function useActivities(eventProjectId: string | null | undefined) {
  return useQuery<EventActivity[]>({
    queryKey: activitiesKey(eventProjectId ?? ''),
    queryFn: () =>
      fetchApi<EventActivity[]>(`/api/events/projects/${eventProjectId}/activities`),
    enabled: !!eventProjectId,
    staleTime: 30_000,
  })
}

/** Fetch signups for a specific activity. */
export function useActivitySignups(
  eventProjectId: string | null | undefined,
  activityId: string | null | undefined
) {
  return useQuery<ActivitySignup[]>({
    queryKey: ['event-activity-signups', activityId],
    queryFn: () =>
      fetchApi<ActivitySignup[]>(
        `/api/events/projects/${eventProjectId}/activities/signups?activityId=${activityId}`
      ),
    enabled: !!eventProjectId && !!activityId,
    staleTime: 30_000,
  })
}

/** Sign a participant up for an activity (or remove signup). */
export function useActivitySignup(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      activityId,
      registrationId,
      action,
    }: {
      activityId: string
      registrationId: string
      action: 'signup' | 'cancel'
    }) =>
      fetchApi(`/api/events/projects/${eventProjectId}/activities/signups`, {
        method: action === 'signup' ? 'POST' : 'DELETE',
        body: JSON.stringify({ activityId, registrationId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: activitiesKey(eventProjectId),
      })
      queryClient.invalidateQueries({
        queryKey: ['event-activity-signups', variables.activityId],
      })
    },
  })
}

/** Dietary and medical aggregation report (FERPA-gated). */
export function useDietaryMedicalReport(eventProjectId: string | null | undefined) {
  return useQuery<DietaryMedicalReport>({
    queryKey: dietaryMedicalKey(eventProjectId ?? ''),
    queryFn: () =>
      fetchApi<DietaryMedicalReport>(
        `/api/events/projects/${eventProjectId}/dietary-medical`
      ),
    enabled: !!eventProjectId,
    staleTime: 5 * 60_000,
    retry: (failureCount, error: unknown) => {
      // Don't retry on 403 — user lacks permission
      if (error && typeof error === 'object' && 'status' in error) {
        if ((error as { status: number }).status === 403) return false
      }
      return failureCount < 2
    },
  })
}
