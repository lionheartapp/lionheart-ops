'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export interface MyEventPermissions {
  isOwner: boolean
  isOrgAdmin: boolean
  isTeamMember: boolean
  canManageTasks: boolean
  canManageSchedule: boolean
  canViewBudget: boolean
  canManageLogistics: boolean
  canManageCheckin: boolean
  canSendComms: boolean
  canViewRegistrations: boolean
  canManageDocuments: boolean
}

/**
 * Fetches the current user's effective permissions for a specific event.
 * Org admins get full access; team members get their per-user toggles;
 * non-team-members get viewer-only.
 */
export function useMyEventPermissions(eventProjectId: string | null | undefined) {
  return useQuery<MyEventPermissions>({
    queryKey: ['my-event-permissions', eventProjectId],
    queryFn: () =>
      fetchApi<MyEventPermissions>(`/api/events/projects/${eventProjectId}/my-permissions`),
    enabled: !!eventProjectId,
    staleTime: 60_000, // Cache for 1 minute
  })
}
