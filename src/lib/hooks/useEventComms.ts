'use client'

/**
 * Hooks for event communication features — announcements and surveys.
 * Uses TanStack Query for data fetching and mutation management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type {
  EventAnnouncementWithAuthor,
  EventSurveyWithStats,
  AnnouncementAudience,
} from '@/lib/types/events-phase21'
import type { SurveyResults } from '@/lib/services/eventSurveyService'

// ─── Announcements ─────────────────────────────────────────────────────────────

export interface CreateAnnouncementInput {
  title: string
  body: string
  audience: AnnouncementAudience
  targetGroupId?: string | null
}

/**
 * Fetch all announcements for an event project, newest first.
 * Auto-refreshes every 30 seconds.
 */
export function useAnnouncements(eventProjectId: string | null | undefined) {
  return useQuery<EventAnnouncementWithAuthor[]>({
    queryKey: ['event-announcements', eventProjectId],
    queryFn: () =>
      fetchApi<EventAnnouncementWithAuthor[]>(
        `/api/events/projects/${eventProjectId}/announcements`,
      ),
    enabled: !!eventProjectId,
    staleTime: 60_000,
  })
}

/**
 * Create an announcement for an event project.
 * Invalidates the announcements query on success.
 */
export function useCreateAnnouncement(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAnnouncementInput) =>
      fetchApi<EventAnnouncementWithAuthor>(
        `/api/events/projects/${eventProjectId}/announcements`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-announcements', eventProjectId],
      })
    },
  })
}

/**
 * Delete an announcement by ID.
 * Invalidates the announcements query on success.
 */
export function useDeleteAnnouncement(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (announcementId: string) =>
      fetchApi<{ deleted: boolean }>(
        `/api/events/projects/${eventProjectId}/announcements`,
        {
          method: 'DELETE',
          body: JSON.stringify({ announcementId }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-announcements', eventProjectId],
      })
    },
  })
}

// ─── Surveys ──────────────────────────────────────────────────────────────────

export interface CreateSurveyInput {
  formId: string
  opensAt?: string | null
  closesAt?: string | null
}

export interface UpdateSurveyInput {
  surveyId: string
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  opensAt?: string | null
  closesAt?: string | null
}

/**
 * Fetch all surveys for an event project.
 */
export function useSurveys(eventProjectId: string | null | undefined) {
  return useQuery<EventSurveyWithStats[]>({
    queryKey: ['event-surveys', eventProjectId],
    queryFn: () =>
      fetchApi<EventSurveyWithStats[]>(
        `/api/events/projects/${eventProjectId}/surveys`,
      ),
    enabled: !!eventProjectId,
    staleTime: 30_000,
  })
}

/**
 * Create a new survey for an event project.
 * Invalidates the surveys query on success.
 */
export function useCreateSurvey(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSurveyInput) =>
      fetchApi<EventSurveyWithStats>(
        `/api/events/projects/${eventProjectId}/surveys`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-surveys', eventProjectId],
      })
    },
  })
}

/**
 * Update a survey's status or date settings.
 * Invalidates the surveys query on success.
 */
export function useUpdateSurvey(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSurveyInput) =>
      fetchApi<EventSurveyWithStats>(
        `/api/events/projects/${eventProjectId}/surveys`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-surveys', eventProjectId],
      })
    },
  })
}

/**
 * Delete a survey by ID.
 * Invalidates the surveys query on success.
 */
export function useDeleteSurvey(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (surveyId: string) =>
      fetchApi<{ deleted: boolean }>(
        `/api/events/projects/${eventProjectId}/surveys`,
        {
          method: 'DELETE',
          body: JSON.stringify({ surveyId }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-surveys', eventProjectId],
      })
    },
  })
}

/**
 * Fetch aggregated results for a specific survey.
 */
export function useSurveyResults(surveyId: string | null | undefined, eventProjectId: string | null | undefined) {
  return useQuery<SurveyResults>({
    queryKey: ['survey-results', surveyId],
    queryFn: () =>
      fetchApi<SurveyResults>(
        `/api/events/projects/${eventProjectId}/surveys/${surveyId}/responses`,
      ),
    enabled: !!surveyId && !!eventProjectId,
    staleTime: 60_000,
  })
}
