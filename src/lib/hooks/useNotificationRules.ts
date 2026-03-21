'use client'

/**
 * Hooks for event notification rule management.
 * Uses TanStack Query for data fetching and mutation management.
 * Covers the full DRAFT → PENDING_APPROVAL → APPROVED → SENT lifecycle.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { NotificationRuleRow, NotificationRuleInput } from '@/lib/types/notification-orchestration'

// ─── Query keys ───────────────────────────────────────────────────────────────

const notificationRuleKeys = {
  all: (eventProjectId: string) => ['notification-rules', eventProjectId] as const,
}

// ─── useNotificationRules ─────────────────────────────────────────────────────

/**
 * Fetch all notification rules for an event project.
 * Auto-refreshes every 60 seconds to reflect status changes from cron dispatch.
 */
export function useNotificationRules(eventProjectId: string | null | undefined) {
  return useQuery<NotificationRuleRow[]>({
    queryKey: notificationRuleKeys.all(eventProjectId ?? ''),
    queryFn: () =>
      fetchApi<NotificationRuleRow[]>(
        `/api/events/projects/${eventProjectId}/notifications`,
      ),
    enabled: !!eventProjectId,
    staleTime: 60_000,
  })
}

// ─── useNotificationMutations ─────────────────────────────────────────────────

/**
 * Mutations for notification rule management:
 * - createRule: POST to create a new draft rule
 * - updateRule: PATCH to edit an existing rule
 * - deleteRule: DELETE with optimistic removal
 * - submitForApproval: POST /approve with action: 'submit'
 * - approveRule: POST /approve with action: 'approve'
 * - cancelRule: POST /approve with action: 'cancel'
 */
export function useNotificationMutations(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  const queryKey = notificationRuleKeys.all(eventProjectId ?? '')

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  // ── Create ──────────────────────────────────────────────────────────────────

  const createRule = useMutation({
    mutationFn: (data: NotificationRuleInput) =>
      fetchApi<NotificationRuleRow>(
        `/api/events/projects/${eventProjectId}/notifications`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: invalidate,
  })

  // ── Update ──────────────────────────────────────────────────────────────────

  const updateRule = useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: Partial<NotificationRuleInput> }) =>
      fetchApi<NotificationRuleRow>(
        `/api/events/projects/${eventProjectId}/notifications/${ruleId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: invalidate,
  })

  // ── Delete (with optimistic removal) ────────────────────────────────────────

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) =>
      fetchApi<{ deleted: boolean }>(
        `/api/events/projects/${eventProjectId}/notifications/${ruleId}`,
        { method: 'DELETE' },
      ),
    onMutate: async (ruleId) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<NotificationRuleRow[]>(queryKey)
      queryClient.setQueryData<NotificationRuleRow[]>(queryKey, (old) =>
        (old ?? []).filter((r) => r.id !== ruleId),
      )
      return { previous }
    },
    onError: (_err, _ruleId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: invalidate,
  })

  // ── Workflow transitions ─────────────────────────────────────────────────────

  const submitForApproval = useMutation({
    mutationFn: (ruleId: string) =>
      fetchApi<NotificationRuleRow>(
        `/api/events/projects/${eventProjectId}/notifications/${ruleId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'submit' }),
        },
      ),
    onSuccess: invalidate,
  })

  const approveRule = useMutation({
    mutationFn: (ruleId: string) =>
      fetchApi<NotificationRuleRow>(
        `/api/events/projects/${eventProjectId}/notifications/${ruleId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'approve' }),
        },
      ),
    onSuccess: invalidate,
  })

  const cancelRule = useMutation({
    mutationFn: (ruleId: string) =>
      fetchApi<NotificationRuleRow>(
        `/api/events/projects/${eventProjectId}/notifications/${ruleId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'cancel' }),
        },
      ),
    onSuccess: invalidate,
  })

  return {
    createRule,
    updateRule,
    deleteRule,
    submitForApproval,
    approveRule,
    cancelRule,
  }
}

// ─── useAIDraft ───────────────────────────────────────────────────────────────

export interface AIDraftParams {
  eventTitle: string
  eventDate: string
  triggerType: string
  targetAudience: string
  context?: string
}

export interface AIDraftResult {
  subject: string
  body: string
}

/**
 * Mutation hook that calls the AI notification draft endpoint.
 * Returns { subject, body } for populating message content fields.
 * Gracefully handles 503 AI_UNAVAILABLE responses.
 */
export function useAIDraft(eventProjectId: string | null | undefined) {
  return useMutation({
    mutationFn: async (params: AIDraftParams): Promise<AIDraftResult> => {
      const result = await fetchApi<AIDraftResult>(
        `/api/events/projects/${eventProjectId}/notifications/ai-draft`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
      )
      return result
    },
  })
}
