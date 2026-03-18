'use client'

import { useQuery } from '@tanstack/react-query'

interface TenantModule {
  id: string
  moduleId: string
  campusId: string | null
  enabledAt: string
  planTier: string | null
}

const CACHE_KEY = 'cached-modules'

/**
 * Read cached modules from localStorage for instant first render.
 */
function getCachedModules(): TenantModule[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Cache modules in localStorage so subsequent page loads are instant.
 */
export function cacheModules(modules: TenantModule[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(modules))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

async function fetchModules(): Promise<TenantModule[]> {
  const token = localStorage.getItem('auth-token')
  const res = await fetch('/api/modules', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  const modules = data.ok ? data.data : []

  // Update the localStorage cache whenever we fetch fresh data
  cacheModules(modules)

  return modules
}

export function useModules() {
  return useQuery({
    queryKey: ['tenant-modules'],
    queryFn: fetchModules,
    staleTime: 5 * 60 * 1000,
    // Use cached data as initial data so the first render is instant
    initialData: typeof window !== 'undefined' ? getCachedModules() : undefined,
    initialDataUpdatedAt: typeof window !== 'undefined' && localStorage.getItem(CACHE_KEY)
      ? Date.now() - 60_000 // Treat cached data as 1 minute old so it refetches in background
      : undefined,
  })
}

export function useModuleEnabled(moduleId: string): {
  enabled: boolean
  loading: boolean
} {
  const { data, isLoading, isFetching } = useModules()
  const enabled = data?.some((m) => m.moduleId === moduleId) ?? false
  // Only show loading if we have NO data at all (not even cached)
  return { enabled, loading: isLoading && !(data as TenantModule[] | undefined)?.length }
}
