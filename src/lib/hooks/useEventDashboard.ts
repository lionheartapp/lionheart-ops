'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { ScoredActionItem, DashboardStats, ResolveAction } from '@/lib/services/eventDashboardService'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardResponse {
  items: ScoredActionItem[]
  stats: DashboardStats
  aiScored: boolean
}

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const EVENT_DASHBOARD_KEYS = {
  raw: ['event-dashboard', 'raw'] as const,
  scored: ['event-dashboard', 'scored'] as const,
  all: ['event-dashboard'] as const,
}

// ─── useEventDashboard ─────────────────────────────────────────────────────────

/**
 * Two-phase fetch pattern for the event dashboard:
 *
 * Phase 1 (raw): GET /api/events/dashboard?skipAI=true
 *   - Fast, no Gemini call. Returns immediately with rule-sorted items.
 *   - StaleTime: 0 (always refresh on mount).
 *
 * Phase 2 (scored): GET /api/events/dashboard
 *   - Full AI scoring via Gemini. Enabled only after raw data loads.
 *   - StaleTime: 60s (cache AI results).
 *
 * UI renders rawItems first, then swaps to scoredItems when available.
 */
export function useEventDashboard() {
  const rawQuery = useQuery<DashboardResponse>({
    queryKey: EVENT_DASHBOARD_KEYS.raw,
    queryFn: () => fetchApi<DashboardResponse>('/api/events/dashboard?skipAI=true'),
    staleTime: 0,
    gcTime: 5 * 60_000,
  })

  const scoredQuery = useQuery<DashboardResponse>({
    queryKey: EVENT_DASHBOARD_KEYS.scored,
    queryFn: () => fetchApi<DashboardResponse>('/api/events/dashboard'),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: rawQuery.isSuccess,
  })

  // Use scored items if available, fall back to raw items
  const activeData = scoredQuery.data ?? rawQuery.data

  return {
    // Data
    rawItems: rawQuery.data?.items ?? [],
    scoredItems: scoredQuery.data?.items ?? null,
    items: activeData?.items ?? [],
    stats: activeData?.stats ?? { totalActiveEvents: 0, overdueItems: 0, upcomingDeadlines: 0, pendingApprovals: 0 },
    aiScored: scoredQuery.data?.aiScored ?? false,

    // Loading states
    isLoadingRaw: rawQuery.isPending,
    isLoadingScored: scoredQuery.isFetching,
    isError: rawQuery.isError,
    error: rawQuery.error,
  }
}

// ─── useResolveAction ─────────────────────────────────────────────────────────

/**
 * Mutation to resolve a dashboard action item.
 * Optimistically removes the resolved item from both raw and scored lists.
 * Invalidates dashboard queries on settle.
 */
export function useResolveAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (resolveAction: ResolveAction) =>
      fetchApi<{ resolved: boolean; type: string }>('/api/events/dashboard', {
        method: 'POST',
        body: JSON.stringify({ resolveAction }),
      }),

    onMutate: async (resolveAction) => {
      // Cancel any in-flight refetches
      await queryClient.cancelQueries({ queryKey: EVENT_DASHBOARD_KEYS.all })

      // Snapshot previous values for rollback
      const previousRaw = queryClient.getQueryData<DashboardResponse>(EVENT_DASHBOARD_KEYS.raw)
      const previousScored = queryClient.getQueryData<DashboardResponse>(EVENT_DASHBOARD_KEYS.scored)

      // Determine which item ID to remove optimistically
      const resolvedId = getResolvedItemId(resolveAction)

      // Optimistically remove from both caches
      if (resolvedId) {
        const removeItem = (data: DashboardResponse | undefined): DashboardResponse | undefined => {
          if (!data) return data
          return {
            ...data,
            items: data.items.filter((item) => item.id !== resolvedId),
          }
        }

        queryClient.setQueryData(EVENT_DASHBOARD_KEYS.raw, removeItem)
        queryClient.setQueryData(EVENT_DASHBOARD_KEYS.scored, removeItem)
      }

      return { previousRaw, previousScored }
    },

    onError: (_err, _action, context) => {
      // Rollback on error
      if (context?.previousRaw !== undefined) {
        queryClient.setQueryData(EVENT_DASHBOARD_KEYS.raw, context.previousRaw)
      }
      if (context?.previousScored !== undefined) {
        queryClient.setQueryData(EVENT_DASHBOARD_KEYS.scored, context.previousScored)
      }
    },

    onSettled: () => {
      // Refresh both queries after mutation
      queryClient.invalidateQueries({ queryKey: EVENT_DASHBOARD_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the action item ID to remove based on the resolve action.
 * Matches the deterministic ID format from eventDashboardService.ts.
 */
function getResolvedItemId(resolveAction: ResolveAction): string | null {
  if (resolveAction.type === 'complete_task') {
    return `overdue_task_${resolveAction.taskId}`
  }
  if (resolveAction.type === 'approve_event') {
    return `pending_approval_${resolveAction.eventProjectId}`
  }
  // navigate type — no specific item to remove without knowing the item id
  return null
}
