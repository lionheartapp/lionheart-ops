'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PCOServiceType {
  id: string
  name: string
  frequency: string | null
  lastPlanDate: string | null
}

export interface PCOPlanSummary {
  id: string
  serviceTypeId: string
  title: string | null
  seriesTitle: string | null
  dates: string | null
  sortDate: string | null
  planningCenterUrl: string | null
  itemCount: number
}

export interface PCOPlanItem {
  id: string
  itemType: 'song' | 'media' | 'item' | 'header'
  title: string
  description: string | null
  length: number | null
  songId: string | null
  arrangementId: string | null
  key: string | null
  sequence: number
  htmlDetails: string | null
  servicePosition: 'pre' | 'during' | 'post' | null
}

export interface PCOPlanDetail {
  plan: PCOPlanSummary
  items: PCOPlanItem[]
}

export interface PCOServiceLink {
  id: string
  organizationId: string
  eventProjectId: string
  sectionId: string
  pcoServiceTypeId: string
  pcoServiceTypeName: string | null
  pcoPlanId: string
  pcoPlanDate: string | null
  pcoPlanTitle: string | null
  syncDirection: 'import_only' | 'export_only' | 'both'
  lastSyncAt: string | null
  lastSyncStatus: string | null
  autoSync: boolean
  itemMappings: Array<{
    id: string
    pcoItemId: string
    pcoItemType: string
    pcoSongId: string | null
    pcoKey: string | null
    block: { id: string; title: string } | null
  }>
}

export interface ImportResult {
  blocksCreated: number
  blocksUpdated: number
  blocksRemoved: number
  errors: string[]
}

export interface PushResult {
  itemsUpdated: number
  itemsCreated: number
  errors: string[]
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Fetch PCO service types (e.g., "Sunday Service", "Wednesday Night").
 */
export function usePCOServiceTypes(eventProjectId: string | null | undefined) {
  return useQuery<PCOServiceType[]>({
    queryKey: ['pco-service-types', eventProjectId],
    queryFn: () =>
      fetchApi<PCOServiceType[]>(
        `/api/events/projects/${eventProjectId}/schedule/pco?action=service-types`
      ),
    enabled: !!eventProjectId,
    staleTime: 5 * 60_000, // Cache for 5 minutes
  })
}

/**
 * Fetch plans for a specific PCO service type.
 */
export function usePCOPlans(
  eventProjectId: string | null | undefined,
  serviceTypeId: string | null | undefined,
  filter?: 'future' | 'past' | 'no_dates'
) {
  return useQuery<PCOPlanSummary[]>({
    queryKey: ['pco-plans', eventProjectId, serviceTypeId, filter],
    queryFn: () =>
      fetchApi<PCOPlanSummary[]>(
        `/api/events/projects/${eventProjectId}/schedule/pco?action=plans&serviceTypeId=${serviceTypeId}&filter=${filter || 'future'}`
      ),
    enabled: !!eventProjectId && !!serviceTypeId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Fetch items (songs, media, etc.) for a specific PCO plan.
 */
export function usePCOPlanItems(
  eventProjectId: string | null | undefined,
  serviceTypeId: string | null | undefined,
  planId: string | null | undefined
) {
  return useQuery<PCOPlanDetail>({
    queryKey: ['pco-plan-items', eventProjectId, serviceTypeId, planId],
    queryFn: () =>
      fetchApi<PCOPlanDetail>(
        `/api/events/projects/${eventProjectId}/schedule/pco?action=plan-items&serviceTypeId=${serviceTypeId}&planId=${planId}`
      ),
    enabled: !!eventProjectId && !!serviceTypeId && !!planId,
    staleTime: 60_000,
  })
}

/**
 * Get the PCO service link for a schedule section (if any).
 */
export function usePCOServiceLink(
  eventProjectId: string | null | undefined,
  sectionId: string | null | undefined
) {
  return useQuery<PCOServiceLink | null>({
    queryKey: ['pco-service-link', eventProjectId, sectionId],
    queryFn: () =>
      fetchApi<PCOServiceLink | null>(
        `/api/events/projects/${eventProjectId}/schedule/pco?action=link&sectionId=${sectionId}`
      ),
    enabled: !!eventProjectId && !!sectionId,
    staleTime: 30_000,
  })
}

/**
 * Import a PCO service plan into a schedule section.
 */
export function useImportPCOPlan(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      sectionId: string
      serviceTypeId: string
      planId: string
      syncDirection?: 'import_only' | 'export_only' | 'both'
      autoSync?: boolean
      selectedItemIds?: string[]
    }) =>
      fetchApi<ImportResult>(
        `/api/events/projects/${eventProjectId}/schedule/pco`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'import', ...data }),
        }
      ),
    onSuccess: (_result, variables) => {
      // Invalidate schedule blocks, sections, and link queries
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-schedule-sections', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['pco-service-link', eventProjectId, variables.sectionId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Push local schedule changes back to Planning Center.
 */
export function usePushToPCO(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: string) =>
      fetchApi<PushResult>(
        `/api/events/projects/${eventProjectId}/schedule/pco`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'push', sectionId }),
        }
      ),
    onSuccess: (_result, sectionId) => {
      queryClient.invalidateQueries({ queryKey: ['pco-service-link', eventProjectId, sectionId] })
    },
  })
}

/**
 * Remove the PCO link from a section (keeps blocks, just unlinks).
 */
export function useUnlinkPCO(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: string) =>
      fetchApi<{ unlinked: true }>(
        `/api/events/projects/${eventProjectId}/schedule/pco`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'unlink', sectionId }),
        }
      ),
    onSuccess: (_result, sectionId) => {
      queryClient.invalidateQueries({ queryKey: ['pco-service-link', eventProjectId, sectionId] })
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
    },
  })
}

/**
 * Unlink a single PCO item from a section (remove the mapping, optionally delete the block).
 */
export function useUnlinkPCOItem(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { sectionId: string; pcoItemId: string; deleteBlock?: boolean }) =>
      fetchApi<{ unlinked: true }>(
        `/api/events/projects/${eventProjectId}/schedule/pco`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'unlink-item', ...data }),
        }
      ),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pco-service-link', eventProjectId, variables.sectionId] })
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-schedule-sections', eventProjectId] })
    },
  })
}

/**
 * Per-section sync status from auto-sync.
 */
export interface SectionSyncStatus {
  sectionId: string
  newItemCount: number
  removedItemCount: number
  updatedCount: number
  newItemTitles: string[]
}

export interface AutoSyncResult {
  synced: number
  skipped: number
  errors: string[]
  sections: SectionSyncStatus[]
}

/**
 * Auto-sync all PCO-linked sections for a project on mount.
 * UPDATE-ONLY: refreshes existing mapped items, detects new items without importing them.
 * Fires once, skips sections synced within the last 5 minutes (server-side).
 */
export function usePCOAutoSync(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetchApi<AutoSyncResult>(
        `/api/events/projects/${eventProjectId}/schedule/pco`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'sync-all' }),
        }
      ),
    onSuccess: () => {
      // Always invalidate schedule queries — even if the server skipped sync
      // (due to 5-min throttle), we still want fresh data on page load
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-schedule-sections', eventProjectId] })
    },
  })
}
