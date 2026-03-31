'use client'

/**
 * useCrud — one-liner hook for full CRUD operations on any entity.
 *
 * Wraps createCrudApi with TanStack Query useQuery + useMutation,
 * handles cache invalidation, and provides loading/error states.
 *
 * Usage:
 *   const sportApi = createCrudApi<Sport>('sports', '/api/athletics/sports')
 *
 *   function SportsPage() {
 *     const {
 *       items, isLoading, error,         // list query
 *       createMutation, updateMutation, deleteMutation,  // mutations
 *       invalidate,                       // manual invalidation
 *     } = useCrud(sportApi)
 *
 *     // Create
 *     createMutation.mutate({ name: 'Soccer' })
 *
 *     // Update
 *     updateMutation.mutate({ id: '123', data: { name: 'Football' } })
 *
 *     // Delete
 *     deleteMutation.mutate('123')
 *   }
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CrudApi } from '@/lib/api/crud-api'

export interface UseCrudOptions {
  /** Filter params for the list query */
  filters?: Record<string, string>
  /** Whether to enable the list query (default: true) */
  enabled?: boolean
}

export function useCrud<T>(api: CrudApi<T>, options?: UseCrudOptions) {
  const { filters, enabled = true } = options ?? {}
  const queryClient = useQueryClient()

  // List query
  const listQuery = useQuery({
    ...api.queryOptions.list(filters),
    enabled,
  })

  // Invalidate list cache
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: api.keys.all })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: api.create,
    onSuccess: () => invalidate(),
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
      api.update(id, data),
    onSuccess: () => invalidate(),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: api.remove,
    onSuccess: () => invalidate(),
  })

  return {
    // List data
    items: (listQuery.data ?? []) as T[],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,

    // Mutations
    createMutation,
    updateMutation,
    deleteMutation,

    // Cache management
    invalidate,

    // Pass-through for custom queries
    api,
  }
}
