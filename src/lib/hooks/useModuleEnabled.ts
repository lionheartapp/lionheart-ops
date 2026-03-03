'use client'

import { useQuery } from '@tanstack/react-query'

interface TenantModule {
  id: string
  moduleId: string
  campusId: string | null
  enabledAt: string
  planTier: string | null
}

async function fetchModules(): Promise<TenantModule[]> {
  const token = localStorage.getItem('auth-token')
  const res = await fetch('/api/modules', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.ok ? data.data : []
}

export function useModules() {
  return useQuery({
    queryKey: ['tenant-modules'],
    queryFn: fetchModules,
    staleTime: 5 * 60 * 1000,
  })
}

export function useModuleEnabled(moduleId: string): {
  enabled: boolean
  loading: boolean
} {
  const { data, isLoading } = useModules()
  const enabled = data?.some((m) => m.moduleId === moduleId) ?? false
  return { enabled, loading: isLoading }
}
