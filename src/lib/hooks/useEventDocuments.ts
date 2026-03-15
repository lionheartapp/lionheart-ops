'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

// ─── Types ─────────────────────────────────────────────────────────────

export interface DocumentRequirement {
  id: string
  eventProjectId: string
  label: string
  description: string | null
  documentType: string
  isRequired: boolean
  dueDate: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface DocumentRequirementStats {
  totalRequirements: number
  totalRegistrations: number
  completionPercentage: number
}

export interface DocumentRequirementsResponse {
  requirements: DocumentRequirement[]
  stats: DocumentRequirementStats
}

export interface ParticipantCompletion {
  requirementId: string
  isComplete: boolean
  completedAt: string | null
  fileUrl: string | null
  notes: string | null
}

export interface MatrixParticipant {
  registrationId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  email: string
  completions: ParticipantCompletion[]
  completedCount: number
  totalCount: number
  isFullyComplete: boolean
}

export interface DocumentMatrix {
  requirements: DocumentRequirement[]
  participants: MatrixParticipant[]
}

export interface ComplianceAssignee {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface ComplianceItem {
  id: string
  eventProjectId: string
  label: string
  description: string | null
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
  assigneeId: string | null
  assignee: ComplianceAssignee | null
  dueDate: string | null
  fileUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentRequirementInput {
  label: string
  documentType: string
  description?: string
  dueDate?: string | null
  isRequired?: boolean
}

export interface UpdateDocumentRequirementInput {
  label?: string
  documentType?: string
  description?: string | null
  dueDate?: string | null
  isRequired?: boolean
}

export interface UpsertComplianceItemInput {
  id?: string
  label: string
  description?: string | null
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
  assigneeId?: string | null
  dueDate?: string | null
  fileUrl?: string | null
}

// ─── Document Requirements Hooks ───────────────────────────────────────

/**
 * Fetch all document requirements + stats for an event project.
 * Returns { requirements, stats: { totalRequirements, totalRegistrations, completionPercentage } }.
 */
export function useDocumentRequirements(eventProjectId: string | null | undefined) {
  return useQuery<DocumentRequirementsResponse>({
    queryKey: ['event-documents', eventProjectId],
    queryFn: () =>
      fetchApi<DocumentRequirementsResponse>(`/api/events/projects/${eventProjectId}/documents`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Fetch the full participant x document completion matrix.
 * Polls every 30 seconds to stay fresh during day-of use.
 */
export function useDocumentMatrix(eventProjectId: string | null | undefined) {
  return useQuery<DocumentMatrix>({
    queryKey: ['event-document-matrix', eventProjectId],
    queryFn: () =>
      fetchApi<DocumentMatrix>(`/api/events/projects/${eventProjectId}/documents/completions`),
    enabled: !!eventProjectId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

/**
 * Toggle a single document completion cell (optimistic update).
 * Immediately toggles the cell in cache, reverts on error.
 */
export function useToggleCompletion(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      registrationId,
      requirementId,
      isComplete,
    }: {
      registrationId: string
      requirementId: string
      isComplete: boolean
    }) =>
      fetchApi(`/api/events/projects/${eventProjectId}/documents/completions`, {
        method: 'PATCH',
        body: JSON.stringify({ registrationId, requirementId, isComplete }),
      }),

    // Optimistic update — toggle cell immediately
    onMutate: async ({ registrationId, requirementId, isComplete }) => {
      await queryClient.cancelQueries({ queryKey: ['event-document-matrix', eventProjectId] })

      const previous = queryClient.getQueryData<DocumentMatrix>([
        'event-document-matrix',
        eventProjectId,
      ])

      if (previous) {
        const updated: DocumentMatrix = {
          ...previous,
          participants: previous.participants.map((p) => {
            if (p.registrationId !== registrationId) return p
            const updatedCompletions = p.completions.map((c) =>
              c.requirementId === requirementId
                ? { ...c, isComplete, completedAt: isComplete ? new Date().toISOString() : null }
                : c,
            )
            const completedCount = updatedCompletions.filter((c) => c.isComplete).length
            return {
              ...p,
              completions: updatedCompletions,
              completedCount,
              isFullyComplete: completedCount === p.totalCount,
            }
          }),
        }
        queryClient.setQueryData(['event-document-matrix', eventProjectId], updated)
      }

      return { previous }
    },

    // Revert on error
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['event-document-matrix', eventProjectId], context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-document-matrix', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-documents', eventProjectId] })
    },
  })
}

/**
 * Send reminder emails to all families with incomplete documents.
 */
export function useSendReminders(eventProjectId: string | null | undefined) {
  return useMutation({
    mutationFn: (options?: { requirementId?: string }) =>
      fetchApi<{ sent: number }>(`/api/events/projects/${eventProjectId}/documents/reminders`, {
        method: 'POST',
        body: JSON.stringify(options ?? {}),
      }),
  })
}

/**
 * Create a new document requirement.
 * Invalidates requirements + matrix queries on success.
 */
export function useCreateDocumentRequirement(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDocumentRequirementInput) =>
      fetchApi<DocumentRequirement>(`/api/events/projects/${eventProjectId}/documents`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-documents', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-document-matrix', eventProjectId] })
    },
  })
}

/**
 * Update an existing document requirement.
 * Invalidates requirements + matrix queries on success.
 */
export function useUpdateDocumentRequirement(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requirementId, data }: { requirementId: string; data: UpdateDocumentRequirementInput }) =>
      fetchApi<DocumentRequirement>(`/api/events/projects/${eventProjectId}/documents`, {
        method: 'PUT',
        body: JSON.stringify({ requirementId, ...data }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-documents', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-document-matrix', eventProjectId] })
    },
  })
}

/**
 * Delete a document requirement.
 * Invalidates requirements + matrix queries on success.
 */
export function useDeleteDocumentRequirement(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requirementId: string) =>
      fetchApi(`/api/events/projects/${eventProjectId}/documents?requirementId=${requirementId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-documents', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-document-matrix', eventProjectId] })
    },
  })
}

// ─── Compliance Hooks ──────────────────────────────────────────────────

/**
 * Fetch all compliance checklist items for an event project.
 */
export function useComplianceItems(eventProjectId: string | null | undefined) {
  return useQuery<ComplianceItem[]>({
    queryKey: ['event-compliance', eventProjectId],
    queryFn: () =>
      fetchApi<ComplianceItem[]>(`/api/events/projects/${eventProjectId}/compliance`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Create or update a compliance checklist item.
 * Pass `id` in data to update an existing item, omit to create new.
 */
export function useUpsertComplianceItem(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertComplianceItemInput) =>
      fetchApi<ComplianceItem>(`/api/events/projects/${eventProjectId}/compliance`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-compliance', eventProjectId] })
    },
  })
}

/**
 * Delete a compliance checklist item.
 */
export function useDeleteComplianceItem(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      fetchApi(`/api/events/projects/${eventProjectId}/compliance?itemId=${itemId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-compliance', eventProjectId] })
    },
  })
}
