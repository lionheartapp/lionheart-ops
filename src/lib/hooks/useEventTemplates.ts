'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { EventTemplateSummary, EventTemplateDetail } from '@/lib/types/event-template'

// ─── Types ─────────────────────────────────────────────────────────────

export interface SaveAsTemplateInput {
  eventProjectId: string
  name: string
  description?: string
  eventType?: string
}

export interface CreateFromTemplateInput {
  title: string
  startsAt: string
  endsAt: string
  locationText?: string
}

export interface CreateFromTemplateResult {
  eventProjectId: string
}

// ─── Query Hooks ────────────────────────────────────────────────────────

/**
 * Fetch all event templates for the org, with optional type filter.
 * queryKey: ['event-templates', eventType]
 */
export function useTemplates(opts?: { eventType?: string }) {
  const eventType = opts?.eventType
  return useQuery<EventTemplateSummary[]>({
    queryKey: ['event-templates', eventType ?? null],
    queryFn: () => {
      const params = eventType ? `?eventType=${encodeURIComponent(eventType)}` : ''
      return fetchApi<EventTemplateSummary[]>(`/api/events/templates${params}`)
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * Fetch a single template by ID.
 * Enabled only when templateId is provided.
 */
export function useTemplate(templateId: string | null | undefined) {
  return useQuery<EventTemplateDetail>({
    queryKey: ['event-template', templateId],
    queryFn: () => fetchApi<EventTemplateDetail>(`/api/events/templates/${templateId}`),
    enabled: !!templateId,
    staleTime: 5 * 60_000,
  })
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────

/**
 * Returns all template mutation functions:
 * - saveAsTemplate: POST to /api/events/templates
 * - createFromTemplate: POST to /api/events/templates/{id}
 * - deleteTemplate: DELETE /api/events/templates/{id} with optimistic removal
 */
export function useTemplateMutations() {
  const queryClient = useQueryClient()

  const saveAsTemplate = useMutation({
    mutationFn: ({ eventProjectId, name, description, eventType }: SaveAsTemplateInput) =>
      fetchApi<EventTemplateDetail>('/api/events/templates', {
        method: 'POST',
        body: JSON.stringify({ eventProjectId, name, description, eventType }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] })
    },
  })

  const createFromTemplate = useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string
      input: CreateFromTemplateInput
    }) =>
      fetchApi<CreateFromTemplateResult>(`/api/events/templates/${templateId}`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] })
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: (templateId: string) =>
      fetchApi<void>(`/api/events/templates/${templateId}`, {
        method: 'DELETE',
      }),
    // Optimistic removal from all template lists
    onMutate: async (templateId: string) => {
      await queryClient.cancelQueries({ queryKey: ['event-templates'] })

      const previousData = queryClient.getQueriesData<EventTemplateSummary[]>({
        queryKey: ['event-templates'],
      })

      queryClient.setQueriesData<EventTemplateSummary[]>(
        { queryKey: ['event-templates'] },
        (old) => old?.filter((t) => t.id !== templateId) ?? [],
      )

      return { previousData }
    },
    onError: (_err, _templateId, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] })
    },
  })

  return { saveAsTemplate, createFromTemplate, deleteTemplate }
}
