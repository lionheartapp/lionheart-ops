'use client'

/**
 * useOptimisticMutation — Reusable wrapper around TanStack's `useMutation`
 * that codifies the standard snapshot / rollback / invalidate pattern.
 *
 * Replaces ~66 hand-rolled optimistic mutations scattered across the codebase
 * (settings tabs, IT Help Desk, Athletics, Facilities, etc.). Each of those
 * sites was re-implementing the same four steps:
 *
 *   1. onMutate  — cancel in-flight queries, snapshot current cache
 *   2. cache set — write the optimistic next value
 *   3. onError   — roll back to the snapshot
 *   4. onSettled — invalidate the affected query key(s)
 *
 * This hook factors that ceremony into a single, type-safe entry point so
 * callers only write the mutation function and (optionally) the optimistic
 * updater.
 *
 * Typical usage:
 *
 *   const mutation = useOptimisticMutation<Role, UpdateRoleInput, Role[]>({
 *     queryKey: queryKeys.roles.all,
 *     mutationFn: (input) => fetchApi('/api/settings/roles/' + input.id, {
 *       method: 'PATCH',
 *       body: JSON.stringify(input),
 *     }),
 *     optimisticUpdate: (roles, input) =>
 *       roles?.map((r) => (r.id === input.id ? { ...r, ...input } : r)),
 *     invalidateKeys: [queryKeys.permissions.all],
 *   })
 */

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query'

export interface UseOptimisticMutationOptions<TData, TVariables, TSnapshot> {
  /** The query key whose cache should be optimistically updated + invalidated on settle. */
  queryKey: QueryKey
  /** The mutation function (POST/PUT/PATCH/DELETE). */
  mutationFn: (variables: TVariables) => Promise<TData>
  /** Optimistic updater — receives the current cached data + variables, returns the optimistic next value. */
  optimisticUpdate?: (oldData: TSnapshot | undefined, variables: TVariables) => TSnapshot | undefined
  /** Additional query keys to invalidate on settle (side-effect reads). */
  invalidateKeys?: QueryKey[]
  /** Standard passthroughs. */
  onSuccess?: UseMutationOptions<TData, Error, TVariables>['onSuccess']
  onError?: (error: Error, variables: TVariables, snapshot: TSnapshot | undefined) => void
}

interface MutationContext<TSnapshot> {
  snapshot: TSnapshot | undefined
}

export function useOptimisticMutation<TData, TVariables, TSnapshot = unknown>(
  options: UseOptimisticMutationOptions<TData, TVariables, TSnapshot>
) {
  const queryClient = useQueryClient()

  return useMutation<TData, Error, TVariables, MutationContext<TSnapshot>>({
    mutationFn: options.mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey })
      const snapshot = queryClient.getQueryData<TSnapshot>(options.queryKey)
      if (options.optimisticUpdate) {
        const next = options.optimisticUpdate(snapshot, variables)
        if (next !== undefined) queryClient.setQueryData(options.queryKey, next)
      }
      return { snapshot }
    },
    onError: (error, variables, context) => {
      // Roll back
      if (context) queryClient.setQueryData(options.queryKey, context.snapshot)
      options.onError?.(error, variables, context?.snapshot)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: options.queryKey })
      options.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    },
    onSuccess: options.onSuccess,
  })
}
