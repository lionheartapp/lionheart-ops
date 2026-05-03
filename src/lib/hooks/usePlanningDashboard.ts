'use client'

import { useQuery } from '@tanstack/react-query'

/**
 * F-010: shared TanStack Query hook for /api/planning-seasons/my-dashboard.
 *
 * Before: PlanningSeasonWidget and YearPlanPrompt both used raw fetch +
 * useState + useEffect, each firing its own request when both happened to
 * mount on the dashboard. Now they share a single cache key keyed on the
 * active school so multiple subscribers in the same render share one
 * round-trip.
 *
 * The shape returned by /api/planning-seasons/my-dashboard varies a bit
 * by caller:
 *   - PlanningSeasonWidget reads json.data (DashboardPlanningData shape)
 *   - YearPlanPrompt reads json.data.season (ActiveSeason | null)
 * Both consumers can pull the slice they need from the same cached blob.
 */
export interface PlanningDashboardData {
  season: {
    id: string
    name: string
    schoolYear: string
    isSubmissionsOpen: boolean
    submissionsOpenAt: string | null
    submissionsCloseAt: string | null
    [key: string]: unknown
  } | null
  submissions?: unknown[]
  [key: string]: unknown
}

interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

async function fetchPlanningDashboard(
  schoolId: string | null
): Promise<PlanningDashboardData | null> {
  const url = schoolId
    ? `/api/planning-seasons/my-dashboard?schoolId=${encodeURIComponent(schoolId)}`
    : '/api/planning-seasons/my-dashboard'
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) return null
  const json = (await res.json()) as ApiEnvelope<PlanningDashboardData>
  return json.ok && json.data ? json.data : null
}

export function usePlanningDashboard(schoolId: string | null) {
  return useQuery({
    queryKey: ['planning-dashboard', schoolId ?? 'all'],
    queryFn: () => fetchPlanningDashboard(schoolId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
