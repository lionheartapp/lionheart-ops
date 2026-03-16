'use client'

/**
 * useBudget — TanStack Query hooks for the event budget feature.
 *
 * Provides:
 *   useBudgetData       — fetch categories + line items
 *   useBudgetRevenue    — fetch revenue (with optional Stripe sync)
 *   useBudgetReport     — fetch full budget vs actual report
 *   useBudgetMutations  — all create/update/delete mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import type {
  BudgetCategoryRow,
  BudgetLineItemRow,
  BudgetRevenueRow,
  BudgetReportData,
  BudgetLineItemInput,
  BudgetRevenueInput,
} from '@/lib/types/budget'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetDataResponse {
  categories: BudgetCategoryRow[]
  lineItems: BudgetLineItemRow[]
}

export interface BudgetRevenueResponse {
  revenue: BudgetRevenueRow[]
  syncedAt: string | null
}

export interface AddCategoryInput {
  name: string
}

export interface ReceiptUrlResponse {
  signedUrl: string
  path: string
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

const BUDGET_KEY = (id: string) => ['budget', id] as const
const BUDGET_REVENUE_KEY = (id: string) => ['budget-revenue', id] as const
const BUDGET_REPORT_KEY = (id: string) => ['budget-report', id] as const

// ─── Query Hooks ──────────────────────────────────────────────────────────────

/**
 * Fetch categories and line items for an event project.
 * Seeds preset categories on first access (handled server-side).
 */
export function useBudgetData(eventProjectId: string) {
  return useQuery<BudgetDataResponse>({
    queryKey: BUDGET_KEY(eventProjectId),
    queryFn: () =>
      fetchApi<BudgetDataResponse>(`/api/events/projects/${eventProjectId}/budget`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Fetch revenue entries, optionally triggering a Stripe sync.
 * Passes ?sync=true so the server syncs registration revenue on load.
 */
export function useBudgetRevenue(eventProjectId: string) {
  return useQuery<BudgetRevenueResponse>({
    queryKey: BUDGET_REVENUE_KEY(eventProjectId),
    queryFn: () =>
      fetchApi<BudgetRevenueResponse>(
        `/api/events/projects/${eventProjectId}/budget/revenue?sync=true`
      ),
    enabled: !!eventProjectId,
    staleTime: 5 * 60_000,
  })
}

/**
 * Fetch the full budget vs actual report including per-participant cost.
 */
export function useBudgetReport(eventProjectId: string) {
  return useQuery<BudgetReportData>({
    queryKey: BUDGET_REPORT_KEY(eventProjectId),
    queryFn: () =>
      fetchApi<BudgetReportData>(`/api/events/projects/${eventProjectId}/budget/report`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * All budget mutation functions for an event project.
 * Uses useToast for success/error feedback (project pattern — not sonner).
 */
export function useBudgetMutations(eventProjectId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const invalidateBudget = () => {
    queryClient.invalidateQueries({ queryKey: BUDGET_KEY(eventProjectId) })
    queryClient.invalidateQueries({ queryKey: BUDGET_REPORT_KEY(eventProjectId) })
  }

  const invalidateRevenue = () => {
    queryClient.invalidateQueries({ queryKey: BUDGET_REVENUE_KEY(eventProjectId) })
    queryClient.invalidateQueries({ queryKey: BUDGET_REPORT_KEY(eventProjectId) })
  }

  // ── Line item mutations ──────────────────────────────────────────────────

  const addLineItem = useMutation({
    mutationFn: (data: BudgetLineItemInput) =>
      fetchApi<BudgetLineItemRow>(`/api/events/projects/${eventProjectId}/budget`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast('Expense added', 'success')
      invalidateBudget()
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to add expense', 'error')
    },
  })

  const updateLineItem = useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: Partial<BudgetLineItemInput> }) =>
      fetchApi<BudgetLineItemRow>(
        `/api/events/projects/${eventProjectId}/budget/${lineId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      toast('Expense updated', 'success')
      invalidateBudget()
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to update expense', 'error')
    },
  })

  const deleteLineItem = useMutation({
    mutationFn: (lineId: string) =>
      fetchApi<void>(`/api/events/projects/${eventProjectId}/budget/${lineId}`, {
        method: 'DELETE',
      }),
    // Optimistic removal from cache
    onMutate: async (lineId: string) => {
      await queryClient.cancelQueries({ queryKey: BUDGET_KEY(eventProjectId) })
      const previous = queryClient.getQueryData<BudgetDataResponse>(BUDGET_KEY(eventProjectId))
      if (previous) {
        queryClient.setQueryData<BudgetDataResponse>(BUDGET_KEY(eventProjectId), {
          ...previous,
          lineItems: previous.lineItems.filter((item) => item.id !== lineId),
        })
      }
      return { previous }
    },
    onError: (err: Error, _lineId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BUDGET_KEY(eventProjectId), context.previous)
      }
      toast(err.message || 'Failed to delete expense', 'error')
    },
    onSuccess: () => {
      toast('Expense deleted', 'success')
      invalidateBudget()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_KEY(eventProjectId) })
    },
  })

  // ── Revenue mutations ────────────────────────────────────────────────────

  const addRevenue = useMutation({
    mutationFn: (data: BudgetRevenueInput) =>
      fetchApi<BudgetRevenueRow>(
        `/api/events/projects/${eventProjectId}/budget/revenue`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      toast('Revenue entry added', 'success')
      invalidateRevenue()
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to add revenue', 'error')
    },
  })

  const updateRevenue = useMutation({
    mutationFn: ({ revenueId, data }: { revenueId: string; data: Partial<BudgetRevenueInput> }) =>
      fetchApi<BudgetRevenueRow>(
        `/api/events/projects/${eventProjectId}/budget/revenue`,
        {
          method: 'PATCH',
          body: JSON.stringify({ id: revenueId, ...data }),
        }
      ),
    onSuccess: () => {
      toast('Revenue entry updated', 'success')
      invalidateRevenue()
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to update revenue', 'error')
    },
  })

  const deleteRevenue = useMutation({
    mutationFn: (revenueId: string) =>
      fetchApi<void>(
        `/api/events/projects/${eventProjectId}/budget/revenue`,
        {
          method: 'DELETE',
          body: JSON.stringify({ id: revenueId }),
        }
      ),
    // Optimistic removal from cache
    onMutate: async (revenueId: string) => {
      await queryClient.cancelQueries({ queryKey: BUDGET_REVENUE_KEY(eventProjectId) })
      const previous = queryClient.getQueryData<BudgetRevenueResponse>(
        BUDGET_REVENUE_KEY(eventProjectId)
      )
      if (previous) {
        queryClient.setQueryData<BudgetRevenueResponse>(BUDGET_REVENUE_KEY(eventProjectId), {
          ...previous,
          revenue: previous.revenue.filter((r) => r.id !== revenueId),
        })
      }
      return { previous }
    },
    onError: (err: Error, _revenueId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BUDGET_REVENUE_KEY(eventProjectId), context.previous)
      }
      toast(err.message || 'Failed to delete revenue entry', 'error')
    },
    onSuccess: () => {
      toast('Revenue entry deleted', 'success')
      invalidateRevenue()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_REVENUE_KEY(eventProjectId) })
    },
  })

  const addCategory = useMutation({
    mutationFn: (data: AddCategoryInput) =>
      fetchApi<BudgetCategoryRow>(
        `/api/events/projects/${eventProjectId}/budget`,
        {
          method: 'POST',
          body: JSON.stringify({ _type: 'category', ...data }),
        }
      ),
    onSuccess: () => {
      toast('Category added', 'success')
      invalidateBudget()
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to add category', 'error')
    },
  })

  return {
    addLineItem,
    updateLineItem,
    deleteLineItem,
    addRevenue,
    updateRevenue,
    deleteRevenue,
    addCategory,
  }
}

/**
 * Generate a signed Supabase upload URL for a receipt image.
 */
export function useGetReceiptUploadUrl(eventProjectId: string) {
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ lineId, filename, contentType }: { lineId: string; filename: string; contentType: string }) =>
      fetchApi<ReceiptUrlResponse>(
        `/api/events/projects/${eventProjectId}/budget/${lineId}/receipt-url`,
        {
          method: 'POST',
          body: JSON.stringify({ filename, contentType }),
        }
      ),
    onError: (err: Error) => {
      toast(err.message || 'Failed to get upload URL', 'error')
    },
  })
}
