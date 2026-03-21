'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type {
  CreateScheduleBlockInput,
  UpdateScheduleBlockInput,
  CreateScheduleSectionInput,
  UpdateScheduleSectionInput,
} from '@/lib/types/event-project'
import type { EventScheduleBlock } from './useEventProject'

// ─── Section Types ────────────────────────────────────────────────────

export interface EventScheduleSection {
  id: string
  eventProjectId: string
  date: string
  title: string
  startTime: string  // HH:mm — section start time for sequential block computation
  layout: 'sequential' | 'parallel'
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ─── Section Hooks ────────────────────────────────────────────────────

/**
 * Fetch schedule sections for an event project, scoped to a specific date.
 * @param date - ISO date string like "2026-04-09"
 */
export function useScheduleSections(eventProjectId: string | null | undefined, date?: string) {
  return useQuery<EventScheduleSection[]>({
    queryKey: ['event-schedule-sections', eventProjectId, date],
    queryFn: () => {
      const dateParam = date ? `?date=${date}` : ''
      return fetchApi<EventScheduleSection[]>(
        `/api/events/projects/${eventProjectId}/schedule/sections${dateParam}`,
      )
    },
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Create a new schedule section (includes date).
 */
export function useCreateScheduleSection(eventProjectId: string | null | undefined, date?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateScheduleSectionInput) =>
      fetchApi<EventScheduleSection>(
        `/api/events/projects/${eventProjectId}/schedule/sections`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule-sections', eventProjectId, date] })
    },
  })
}

/**
 * Update a schedule section (rename, reorder).
 */
export function useUpdateScheduleSection(eventProjectId: string | null | undefined, date?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: UpdateScheduleSectionInput }) =>
      fetchApi<EventScheduleSection>(
        `/api/events/projects/${eventProjectId}/schedule/sections/${sectionId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule-sections', eventProjectId, date] })
    },
  })
}

/**
 * Delete a schedule section. Blocks in the section become unassigned.
 */
export function useDeleteScheduleSection(eventProjectId: string | null | undefined, date?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: string) =>
      fetchApi<{ deleted: true }>(
        `/api/events/projects/${eventProjectId}/schedule/sections/${sectionId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule-sections', eventProjectId, date] })
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
    },
  })
}

/**
 * Reorder sections by sending an ordered array of section IDs.
 * Each section's sortOrder is updated to match its index.
 * Uses optimistic updates for instant visual feedback.
 */
export function useReorderSections(eventProjectId: string | null | undefined, date?: string) {
  const queryClient = useQueryClient()
  const queryKey = ['event-schedule-sections', eventProjectId, date]
  return useMutation({
    mutationFn: (sectionIds: string[]) =>
      fetchApi<{ reordered: number }>(
        `/api/events/projects/${eventProjectId}/schedule/sections/reorder`,
        { method: 'PATCH', body: JSON.stringify({ sectionIds }) },
      ),
    onMutate: async (sectionIds: string[]) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<EventScheduleSection[]>(queryKey)

      if (previous) {
        const sectionMap = new Map(previous.map((s) => [s.id, s]))
        const reordered = sectionIds
          .map((id, i) => {
            const section = sectionMap.get(id)
            if (!section) return null
            return { ...section, sortOrder: i }
          })
          .filter(Boolean) as EventScheduleSection[]

        queryClient.setQueryData<EventScheduleSection[]>(queryKey, reordered)
      }

      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

// ─── Block Hooks ──────────────────────────────────────────────────────

/**
 * Fetch all schedule blocks for an event project.
 * Returns blocks sorted by startsAt (server-side ordering).
 */
export function useScheduleBlocks(eventProjectId: string | null | undefined) {
  return useQuery<EventScheduleBlock[]>({
    queryKey: ['event-schedule', eventProjectId],
    queryFn: () => fetchApi<EventScheduleBlock[]>(`/api/events/projects/${eventProjectId}/schedule`),
    enabled: !!eventProjectId,
    staleTime: 2 * 60_000,
  })
}

/**
 * Create a new schedule block for an event project.
 * Invalidates schedule and activity queries on success.
 */
export function useCreateScheduleBlock(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateScheduleBlockInput) =>
      fetchApi<EventScheduleBlock>(`/api/events/projects/${eventProjectId}/schedule`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Update an existing schedule block (partial update).
 * Invalidates schedule and activity queries on success.
 */
export function useUpdateScheduleBlock(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ blockId, data }: { blockId: string; data: UpdateScheduleBlockInput }) =>
      fetchApi<EventScheduleBlock>(`/api/events/projects/${eventProjectId}/schedule/${blockId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Delete a schedule block (hard delete).
 * Invalidates schedule and activity queries on success.
 */
export function useDeleteScheduleBlock(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (blockId: string) =>
      fetchApi<void>(`/api/events/projects/${eventProjectId}/schedule/${blockId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
      queryClient.invalidateQueries({ queryKey: ['event-activity', eventProjectId] })
    },
  })
}

/**
 * Reorder schedule blocks by sending an ordered array of block IDs.
 * The server updates each block's sortOrder to match its array index.
 * Uses optimistic updates for instant visual feedback during drag-and-drop.
 */
export function useReorderScheduleBlocks(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (blockIds: string[]) =>
      fetchApi<{ reordered: number }>(`/api/events/projects/${eventProjectId}/schedule/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ blockIds }),
      }),
    onMutate: async (blockIds: string[]) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['event-schedule', eventProjectId] })

      // Snapshot previous value
      const previous = queryClient.getQueryData<EventScheduleBlock[]>(['event-schedule', eventProjectId])

      // Optimistically reorder
      if (previous) {
        const blockMap = new Map(previous.map((b) => [b.id, b]))
        const reordered = blockIds
          .map((id, i) => {
            const block = blockMap.get(id)
            if (!block) return null
            return { ...block, sortOrder: i }
          })
          .filter(Boolean) as EventScheduleBlock[]

        // Include any blocks not in the reorder list (other sections)
        const reorderedIds = new Set(blockIds)
        const rest = previous.filter((b) => !reorderedIds.has(b.id))

        queryClient.setQueryData<EventScheduleBlock[]>(
          ['event-schedule', eventProjectId],
          [...reordered, ...rest],
        )
      }

      return { previous }
    },
    onError: (_err, _blockIds, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['event-schedule', eventProjectId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
    },
  })
}

/**
 * Assign a block to a section (or unassign by passing null).
 * Used when dragging a block into/out of a section.
 */
export function useAssignBlockToSection(eventProjectId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ blockId, sectionId }: { blockId: string; sectionId: string | null }) =>
      fetchApi<EventScheduleBlock>(
        `/api/events/projects/${eventProjectId}/schedule/${blockId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ sectionId }),
        },
      ),
    onMutate: async ({ blockId, sectionId }) => {
      await queryClient.cancelQueries({ queryKey: ['event-schedule', eventProjectId] })
      const previous = queryClient.getQueryData<EventScheduleBlock[]>(['event-schedule', eventProjectId])

      if (previous) {
        queryClient.setQueryData<EventScheduleBlock[]>(
          ['event-schedule', eventProjectId],
          previous.map((b) =>
            b.id === blockId ? { ...b, sectionId } : b,
          ),
        )
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['event-schedule', eventProjectId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-schedule', eventProjectId] })
    },
  })
}

// ─── Block Attachment Types ──────────────────────────────────────────

export interface ScheduleBlockAttachment {
  id: string
  blockId: string
  uploadedById: string
  fileName: string
  fileUrl: string
  contentType: string
  sizeBytes: number
  createdAt: string
  uploadedBy: {
    id: string
    name: string | null
    firstName: string | null
    lastName: string | null
  } | null
}

// ─── Block Attachment Hooks ──────────────────────────────────────────

/**
 * Fetch all attachments for a specific schedule block.
 */
export function useBlockAttachments(eventProjectId: string | null | undefined, blockId: string | null | undefined) {
  return useQuery<ScheduleBlockAttachment[]>({
    queryKey: ['block-attachments', eventProjectId, blockId],
    queryFn: () =>
      fetchApi<ScheduleBlockAttachment[]>(
        `/api/events/projects/${eventProjectId}/schedule/${blockId}/attachments`,
      ),
    enabled: !!eventProjectId && !!blockId,
    staleTime: 60_000,
  })
}

/**
 * Upload a file attachment to a schedule block.
 */
export function useUploadBlockAttachment(eventProjectId: string | null | undefined, blockId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { fileName: string; fileBase64: string; contentType: string }) =>
      fetchApi<ScheduleBlockAttachment>(
        `/api/events/projects/${eventProjectId}/schedule/${blockId}/attachments`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-attachments', eventProjectId, blockId] })
    },
  })
}

/**
 * Delete a file attachment from a schedule block.
 */
export function useDeleteBlockAttachment(eventProjectId: string | null | undefined, blockId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) =>
      fetchApi<{ deleted: true }>(
        `/api/events/projects/${eventProjectId}/schedule/${blockId}/attachments/${attachmentId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-attachments', eventProjectId, blockId] })
    },
  })
}
