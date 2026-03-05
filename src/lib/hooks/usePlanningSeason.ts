'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────────────────

export interface PlanningSeason {
  id: string
  name: string
  startDate: string
  endDate: string
  submissionOpen: string
  submissionClose: string
  finalizationDeadline: string | null
  budgetCap: number | null
  phase: string
  campus?: { id: string; name: string } | null
  school?: { id: string; name: string } | null
  _count?: { submissions: number; conflicts: number; blackoutDates: number }
}

export interface PlanningSubmission {
  id: string
  planningSeasonId: string
  title: string
  description: string | null
  preferredDate: string
  alternateDate1: string | null
  alternateDate2: string | null
  duration: number
  isOutdoor: boolean
  expectedAttendance: number | null
  targetAudience: string | null
  priority: string
  estimatedBudget: number | null
  submissionStatus: string
  adminNotes: string | null
  submittedBy: { id: string; firstName: string | null; lastName: string | null; email: string }
  resourceNeeds: Array<{ id: string; resourceType: string; details: string | null }>
  _count?: { comments: number }
}

export interface PlanningComment {
  id: string
  message: string
  isAdminOnly: boolean
  createdAt: string
  author: { id: string; firstName: string | null; lastName: string | null }
}

export interface BlackoutDate {
  id: string
  date: string
  reason: string | null
}

export interface PlanningConflict {
  id: string
  conflictType: string
  severity: string
  description: string
  affectedIds: string[]
  suggestedResolution: string | null
  isResolved: boolean
}

// ── API Helpers ────────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options?.headers } })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || 'Request failed')
  return data.data
}

// ── Season Hooks ───────────────────────────────────────────────────────

export function useSeasons() {
  return useQuery<PlanningSeason[]>({
    queryKey: ['planning-seasons'],
    queryFn: () => apiFetch('/api/planning-seasons'),
  })
}

export function useSeason(id: string | null) {
  return useQuery<PlanningSeason>({
    queryKey: ['planning-season', id],
    queryFn: () => apiFetch(`/api/planning-seasons/${id}`),
    enabled: !!id,
  })
}

export function useCreateSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/api/planning-seasons', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-seasons'] }),
  })
}

export function useTransitionPhase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, phase }: { id: string; phase: string }) =>
      apiFetch(`/api/planning-seasons/${id}/phase`, { method: 'PUT', body: JSON.stringify({ phase }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-seasons'] }),
  })
}

export function useUpdateSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/api/planning-seasons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-seasons'] }),
  })
}

export function useDeleteSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/planning-seasons/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-seasons'] }),
  })
}

// ── Submission Hooks ───────────────────────────────────────────────────

export function useSubmissions(seasonId: string | null, filters?: { status?: string; submittedById?: string }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.submittedById) params.set('submittedById', filters.submittedById)
  const qs = params.toString() ? `?${params}` : ''

  return useQuery<PlanningSubmission[]>({
    queryKey: ['planning-submissions', seasonId, filters],
    queryFn: () => apiFetch(`/api/planning-seasons/${seasonId}/submissions${qs}`),
    enabled: !!seasonId,
  })
}

export function useCreateSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, data }: { seasonId: string; data: Record<string, unknown> }) =>
      apiFetch(`/api/planning-seasons/${seasonId}/submissions`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-submissions'] }),
  })
}

export function useSubmitSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, subId }: { seasonId: string; subId: string }) =>
      apiFetch(`/api/planning-seasons/${seasonId}/submissions/${subId}/submit`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-submissions'] }),
  })
}

export function useReviewSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, subId, data }: { seasonId: string; subId: string; data: { status: string; adminNotes?: string } }) =>
      apiFetch(`/api/planning-seasons/${seasonId}/submissions/${subId}/review`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-submissions'] }),
  })
}

// ── Comment Hooks ──────────────────────────────────────────────────────

export function useComments(seasonId: string | null, subId: string | null) {
  return useQuery<PlanningComment[]>({
    queryKey: ['planning-comments', seasonId, subId],
    queryFn: () => apiFetch(`/api/planning-seasons/${seasonId}/submissions/${subId}/comments`),
    enabled: !!seasonId && !!subId,
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, subId, message, isAdminOnly }: { seasonId: string; subId: string; message: string; isAdminOnly?: boolean }) =>
      apiFetch(`/api/planning-seasons/${seasonId}/submissions/${subId}/comments`, {
        method: 'POST', body: JSON.stringify({ message, isAdminOnly }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-comments'] }),
  })
}

// ── Blackout Hooks ─────────────────────────────────────────────────────

export function useBlackoutDates(seasonId: string | null) {
  return useQuery<BlackoutDate[]>({
    queryKey: ['planning-blackout-dates', seasonId],
    queryFn: () => apiFetch(`/api/planning-seasons/${seasonId}/blackout-dates`),
    enabled: !!seasonId,
  })
}

// ── Conflict Hooks ─────────────────────────────────────────────────────

export function useConflicts(seasonId: string | null) {
  return useQuery<PlanningConflict[]>({
    queryKey: ['planning-conflicts', seasonId],
    queryFn: () => apiFetch(`/api/planning-seasons/${seasonId}/conflicts`),
    enabled: !!seasonId,
  })
}

// ── Bulk Publish ───────────────────────────────────────────────────────

export function useBulkPublish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, calendarId }: { seasonId: string; calendarId: string }) =>
      apiFetch(`/api/planning-seasons/${seasonId}/publish`, { method: 'POST', body: JSON.stringify({ calendarId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-submissions'] }),
  })
}
