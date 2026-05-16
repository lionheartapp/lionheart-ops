/**
 * useFormSubmissions — hooks for listing, creating, and managing form submissions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { SubmissionStatus } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormSubmission {
  id: string
  formId: string
  organizationId: string
  submittedBy: string | null
  submitterName: string | null
  submitterEmail: string | null
  data: Record<string, unknown>
  status: SubmissionStatus
  isDraft: boolean
  draftExpiresAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

interface SubmissionCounts {
  total: number
  pending: number
  draft: number
}

interface SubmissionsResponse {
  submissions: FormSubmission[]
  counts: SubmissionCounts
}

// ─── List Submissions ────────────────────────────────────────────────────────

export function useFormSubmissions(
  formId: string | null | undefined,
  filters?: { status?: SubmissionStatus; search?: string; isDraft?: boolean }
) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.isDraft !== undefined) params.set('isDraft', String(filters.isDraft))
  const qs = params.toString()

  return useQuery({
    queryKey: ['form-submissions', formId, filters],
    queryFn: () =>
      fetchApi<SubmissionsResponse>(
        `/api/forms/${formId}/submissions${qs ? `?${qs}` : ''}`
      ),
    enabled: !!formId,
  })
}

// ─── Get Single Submission ───────────────────────────────────────────────────

export function useFormSubmission(formId: string | null, subId: string | null) {
  return useQuery({
    queryKey: ['form-submission', formId, subId],
    queryFn: () =>
      fetchApi<FormSubmission>(`/api/forms/${formId}/submissions/${subId}`),
    enabled: !!formId && !!subId,
  })
}

// ─── Create Submission ───────────────────────────────────────────────────────

export function useCreateFormSubmission(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      data: Record<string, unknown>
      isDraft?: boolean
      submitterName?: string
      submitterEmail?: string
    }) =>
      fetchApi<FormSubmission>(`/api/forms/${formId}/submissions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions', formId] })
    },
  })
}

// ─── Update Submission Status ────────────────────────────────────────────────

export function useUpdateSubmissionStatus(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subId, status }: { subId: string; status: SubmissionStatus }) =>
      fetchApi<FormSubmission>(`/api/forms/${formId}/submissions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { subId }) => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions', formId] })
      queryClient.invalidateQueries({ queryKey: ['form-submission', formId, subId] })
    },
  })
}

// ─── Update Draft Data ──────────────────────────────────────────────────────

export function useUpdateDraft(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subId, data }: { subId: string; data: Record<string, unknown> }) =>
      fetchApi<FormSubmission>(`/api/forms/${formId}/submissions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ data }),
      }),
    onSuccess: (_, { subId }) => {
      queryClient.invalidateQueries({ queryKey: ['form-submission', formId, subId] })
    },
  })
}

// ─── Delete Submission ───────────────────────────────────────────────────────

export function useDeleteSubmission(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subId: string) =>
      fetchApi(`/api/forms/${formId}/submissions/${subId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions', formId] })
    },
  })
}
