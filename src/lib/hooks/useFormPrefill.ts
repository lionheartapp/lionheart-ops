/**
 * useFormPrefill — fetches pre-fill values for a form based on the current user's context.
 *
 * Fields with a prefillSource (e.g. "user.name", "user.email", "school.name")
 * are resolved server-side and returned as a key-value map.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export function useFormPrefill(formId: string | null | undefined) {
  return useQuery({
    queryKey: ['form-prefill', formId],
    queryFn: () =>
      fetchApi<Record<string, string>>(`/api/forms/${formId}/prefill`),
    enabled: !!formId,
    staleTime: 5 * 60 * 1000, // user context rarely changes
  })
}
