'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { CreateEventProjectInput, UpdateEventProjectInput } from '@/lib/types/event-project'

// ─── Types ─────────────────────────────────────────────────────────────

export interface EventProject {
  id: string
  title: string
  description: string | null
  status: string
  source: string
  coverImageUrl: string | null
  startsAt: string
  endsAt: string
  isMultiDay: boolean
  expectedAttendance: number | null
  locationText: string | null
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  campusId: string | null
  schoolId: string | null
  calendarId: string | null
  seriesId: string | null
  sourceId: string | null
  organizationId: string
  createdById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  metadata: Record<string, unknown> | null
  requiresAV?: boolean
  requiresFacilities?: boolean
  approvalGates?: {
    av?: { status: string; respondedById?: string | null; reason?: string | null; respondedAt?: string | null }
    facilities?: { status: string; respondedById?: string | null; reason?: string | null; respondedAt?: string | null }
    admin: { status: string; respondedById?: string | null; reason?: string | null; respondedAt?: string | null }
  } | null
  rejectionReason?: string | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; displayName?: string | null; roomNumber?: string | null } | null
  campus?: { id: string; name: string } | null
  school?: { id: string; name: string } | null
  createdBy?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
  } | null
  scheduleBlocks?: EventScheduleBlock[]
  tasks?: EventTask[]
  activityLog?: EventActivityLog[]
  _count?: {
    scheduleBlocks: number
    tasks: number
    activityLog: number
  }
}

export interface EventScheduleBlock {
  id: string
  eventProjectId: string
  type: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  locationText: string | null
  leadId: string | null
  sortOrder: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  lead?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

export interface EventTask {
  id: string
  eventProjectId: string
  title: string
  description: string | null
  status: string
  priority: string
  category: string | null
  assigneeId: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  assignee?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
  } | null
}

export interface EventActivityLog {
  id: string
  eventProjectId: string
  actorId: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  actor?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
  } | null
}

export interface EventProjectFilters {
  status?: string
  campusId?: string
  schoolId?: string
  createdBy?: string
  limit?: number
  page?: number
}

// ─── Helpers ───────────────────────────────────────────────────────────

function buildQueryString(filters?: Record<string, string | number | undefined>): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Hooks ─────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of event projects with optional filters.
 * Returns data array (not the paginated envelope) for ease of use.
 */
export function useEventProjects(filters?: EventProjectFilters) {
  const qs = buildQueryString(filters as Record<string, string | number | undefined>)
  return useQuery<EventProject[]>({
    queryKey: ['event-projects', filters],
    queryFn: () => fetchApi<EventProject[]>(`/api/events/projects${qs}`),
    staleTime: 2 * 60_000,
  })
}

/**
 * Fetch a single event project by ID with full detail (schedule, tasks, activity, createdBy).
 */
export function useEventProject(id: string | null | undefined) {
  return useQuery<EventProject>({
    queryKey: ['event-project', id],
    queryFn: () => fetchApi<EventProject>(`/api/events/projects/${id}`),
    enabled: !!id,
    staleTime: 2 * 60_000,
  })
}

/**
 * Create a new event project.
 * Invalidates the event projects list on success.
 */
export function useCreateEventProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventProjectInput) =>
      fetchApi<EventProject>('/api/events/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
    },
  })
}

/**
 * Update an existing event project by ID.
 * Invalidates both the list and the individual project detail.
 */
export function useUpdateEventProject(id: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEventProjectInput) =>
      fetchApi<EventProject>(`/api/events/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
      queryClient.invalidateQueries({ queryKey: ['event-project', id] })
    },
  })
}

/**
 * Approve an event project (PENDING_APPROVAL → CONFIRMED).
 * Invalidates the project detail and list on success.
 */
export function useApproveEventProject(id: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetchApi<EventProject>(`/api/events/projects/${id}/approve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-project', id] })
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
    },
  })
}

/**
 * Approve a specific gate (av, facilities, admin) on an event project.
 */
export function useApproveGate(id: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (gateType: 'av' | 'facilities' | 'admin') =>
      fetchApi<EventProject>(`/api/events/projects/${id}/approve-gate`, {
        method: 'POST',
        body: JSON.stringify({ gateType }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-project', id] })
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
      queryClient.invalidateQueries({ queryKey: ['event-dashboard'] })
    },
  })
}

/**
 * Reject a specific gate on an event project.
 */
export function useRejectGate(id: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { gateType: 'av' | 'facilities' | 'admin'; reason: string }) =>
      fetchApi<EventProject>(`/api/events/projects/${id}/reject-gate`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-project', id] })
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
      queryClient.invalidateQueries({ queryKey: ['event-dashboard'] })
    },
  })
}

/**
 * Resubmit an event project after revision following a rejection.
 */
export function useResubmitForApproval(id: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetchApi<EventProject>(`/api/events/projects/${id}/resubmit`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-project', id] })
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
      queryClient.invalidateQueries({ queryKey: ['event-dashboard'] })
    },
  })
}

/**
 * Fetch EventProjects with a PENDING gate for a specific team.
 */
export function usePendingGateApprovals(gateType: 'av' | 'facilities' | 'admin', enabled = true) {
  return useQuery<EventProject[]>({
    queryKey: ['pending-gates', gateType],
    queryFn: () => fetchApi<EventProject[]>(`/api/events/projects/pending-gates?gateType=${gateType}`),
    enabled,
    staleTime: 30_000,
  })
}

/**
 * Fetch the count of pending gate approvals for a specific team.
 * Lightweight — used for sidebar badge counts.
 */
export function usePendingGateCount(gateType: 'av' | 'facilities' | 'admin', enabled = true) {
  return useQuery<{ count: number }>({
    queryKey: ['pending-gates-count', gateType],
    queryFn: () => fetchApi<{ count: number }>(`/api/events/projects/pending-gates?gateType=${gateType}&countOnly=true`),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * Fetch the activity log for an event project.
 */
export function useEventActivity(id: string | null | undefined) {
  return useQuery<EventActivityLog[]>({
    queryKey: ['event-activity', id],
    queryFn: () => fetchApi<EventActivityLog[]>(`/api/events/projects/${id}/activity`),
    enabled: !!id,
    staleTime: 60_000,
  })
}
