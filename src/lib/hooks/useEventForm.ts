/**
 * useEventForm — fetch, reset, and manage the per-event form copy.
 *
 * The first GET auto-clones the system template if no form exists yet.
 * Subsequent calls return the existing event-specific form.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { SystemFormDefinition } from './useSystemForm'

/** Fetch the form definition for a specific event (auto-clones on first request) */
export function useEventForm(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['event-form', eventId],
    queryFn: () =>
      fetchApi<SystemFormDefinition>(`/api/events/projects/${eventId}/form`),
    enabled: !!eventId,
    staleTime: 30 * 1000,
  })
}

/** Reset the per-event form back to the parent template */
export function useResetEventForm(eventId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetchApi<SystemFormDefinition>(`/api/events/projects/${eventId}/form/reset`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-form', eventId] })
    },
  })
}
