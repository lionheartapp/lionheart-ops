/**
 * CRUD API Factory — generates typed query keys, query options, and mutation
 * helpers for any entity that follows the standard REST pattern.
 *
 * Usage:
 *   const sportApi = createCrudApi<Sport>('sports', '/api/athletics/sports')
 *
 *   // In a component:
 *   const { data } = useQuery(sportApi.queryOptions.list())
 *   const { data } = useQuery(sportApi.queryOptions.detail(id))
 *
 *   // Mutations:
 *   const create = useMutation({ mutationFn: sportApi.create, ... })
 *   const update = useMutation({ mutationFn: (args) => sportApi.update(args.id, args.data), ... })
 *   const remove = useMutation({ mutationFn: sportApi.remove, ... })
 *
 *   // Invalidation:
 *   queryClient.invalidateQueries({ queryKey: sportApi.keys.all })
 */

import { fetchApi } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrudApi<T> {
  /** Query key hierarchy for cache management */
  keys: {
    all: readonly [string]
    list: (filters?: Record<string, string>) => readonly [string, Record<string, string>]
    detail: (id: string) => readonly [string, string]
  }

  /** TanStack Query option factories (queryKey + queryFn + staleTime) */
  queryOptions: {
    list: (filters?: Record<string, string>) => {
      queryKey: readonly [string, Record<string, string>]
      queryFn: () => Promise<T[]>
      staleTime: number
    }
    detail: (id: string) => {
      queryKey: readonly [string, string]
      queryFn: () => Promise<T>
      staleTime: number
    }
  }

  /** Mutation functions */
  create: (data: Partial<T>) => Promise<T>
  update: (id: string, data: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<{ deleted: boolean }>

  /** Base URL for custom fetch calls */
  baseUrl: string
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCrudApi<T>(
  /** Cache key prefix (e.g. 'sports', 'it-devices') */
  keyPrefix: string,
  /** API base URL (e.g. '/api/athletics/sports') */
  baseUrl: string,
  options?: {
    /** Stale time for list queries in ms (default: 5 min) */
    listStaleTime?: number
    /** Stale time for detail queries in ms (default: 2 min) */
    detailStaleTime?: number
  }
): CrudApi<T> {
  const listStaleTime = options?.listStaleTime ?? 5 * 60 * 1000
  const detailStaleTime = options?.detailStaleTime ?? 2 * 60 * 1000

  const keys = {
    all: [keyPrefix] as const,
    list: (filters?: Record<string, string>) =>
      [keyPrefix, filters ?? {}] as const,
    detail: (id: string) => [`${keyPrefix}-detail`, id] as const,
  }

  function buildQueryString(filters?: Record<string, string>): string {
    if (!filters) return ''
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v)
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  return {
    keys,
    baseUrl,

    queryOptions: {
      list: (filters?: Record<string, string>) => ({
        queryKey: keys.list(filters),
        queryFn: () => fetchApi<T[]>(`${baseUrl}${buildQueryString(filters)}`),
        staleTime: listStaleTime,
      }),
      detail: (id: string) => ({
        queryKey: keys.detail(id),
        queryFn: () => fetchApi<T>(`${baseUrl}/${id}`),
        staleTime: detailStaleTime,
      }),
    },

    create: (data: Partial<T>) =>
      fetchApi<T>(baseUrl, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<T>) =>
      fetchApi<T>(`${baseUrl}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    remove: (id: string) =>
      fetchApi<{ deleted: boolean }>(`${baseUrl}/${id}`, {
        method: 'DELETE',
      }),
  }
}
