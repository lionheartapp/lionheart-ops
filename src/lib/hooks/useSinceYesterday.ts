'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface DiffItem {
  id: string
  category: string
  severity: 'critical' | 'high' | 'normal' | 'good'
  summary: string
  deepLinkPath: string | null
  diffEventIds: string[]
  handled: boolean
  occurredAt: string
}

interface DiffResponse {
  anchorTime: string
  orgTimezone: string
  asOf: string
  items: DiffItem[]
  totals: { unhandled: number; handled: number }
}

const QUERY_KEY = ['dashboard-diff']

async function fetchDiff(): Promise<DiffResponse> {
  const res = await fetch('/api/dashboard/diff', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load diff')
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message ?? 'Unknown error')
  return json.data
}

async function dismissEvents(diffEventIds: string[]): Promise<void> {
  const res = await fetch('/api/dashboard/diff/dismiss', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diffEventIds }),
  })
  if (!res.ok) throw new Error('Failed to dismiss')
}

async function undismissEvents(diffEventIds: string[]): Promise<void> {
  const res = await fetch('/api/dashboard/diff/undismiss', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diffEventIds }),
  })
  if (!res.ok) throw new Error('Failed to undismiss')
}

export function useSinceYesterday() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDiff,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const dismissMutation = useMutation({
    mutationFn: dismissEvents,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<DiffResponse>(QUERY_KEY)
      if (prev) {
        const idSet = new Set(ids)
        queryClient.setQueryData<DiffResponse>(QUERY_KEY, {
          ...prev,
          items: prev.items.map((item) =>
            item.diffEventIds.some((id) => idSet.has(id))
              ? { ...item, handled: true }
              : item
          ),
          totals: {
            unhandled: prev.items.filter(
              (i) => !i.handled && !i.diffEventIds.some((id) => idSet.has(id))
            ).length,
            handled: prev.items.filter(
              (i) => i.handled || i.diffEventIds.some((id) => idSet.has(id))
            ).length,
          },
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const undismissMutation = useMutation({
    mutationFn: undismissEvents,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  return {
    data,
    isLoading,
    isError,
    refetch,
    dismiss: dismissMutation.mutate,
    undismiss: undismissMutation.mutate,
    isDismissing: dismissMutation.isPending,
  }
}
