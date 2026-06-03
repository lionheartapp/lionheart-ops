/**
 * useSystemForm — fetches a system form definition by its systemKey.
 *
 * Used by the event creation modal to render dynamic DEFAULT/CUSTOM fields
 * from the form template, alongside the hardcoded LOCKED field components.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { FormFieldWorkflowAction } from '@/lib/forms/schemas'

interface SystemFormField {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  placeholder: string | null
  helpText: string | null
  options: string[]
  protection: 'LOCKED' | 'DEFAULT' | 'CUSTOM'
  isIncluded: boolean
  sortOrder: number
  pageId: string | null
  autoEscalate: boolean
  workflowActions: FormFieldWorkflowAction[] | null
  condFieldKey: string | null
  condOperator: string | null
  condEquals: string | null
  defaultValue: string | null
  minValue: string | null
  maxValue: string | null
  pattern: string | null
  errorMessage: string | null
}

interface SystemFormPage {
  id: string
  title: string
  description: string | null
  sortOrder: number
  isOptional: boolean
  condFieldKey: string | null
  condOperator: string | null
  condEquals: string | null
  fields: SystemFormField[]
}

export interface SystemFormDefinition {
  id: string
  systemKey: string
  description: string | null
  context: string
  pages: SystemFormPage[]
  fields: SystemFormField[] // loose fields (no page)
  parentTemplateId?: string | null
}

/**
 * Fetch a system form by its systemKey (e.g. "single_event", "multiday_event").
 * Returns the full definition with pages and fields.
 */
export function useSystemForm(systemKey: string | null) {
  return useQuery({
    queryKey: ['system-form', systemKey],
    queryFn: () =>
      fetchApi<SystemFormDefinition>(`/api/forms/system/${systemKey}`),
    enabled: !!systemKey,
    staleTime: 5 * 60 * 1000, // system forms rarely change
  })
}

/**
 * Get only the dynamic fields (DEFAULT + CUSTOM) from a system form,
 * optionally filtered by page title.
 */
export function getDynamicFields(
  form: SystemFormDefinition | undefined,
  pageTitle?: string
): SystemFormField[] {
  if (!form) return []

  const allFields: SystemFormField[] = []

  for (const page of form.pages) {
    if (pageTitle && page.title !== pageTitle) continue
    for (const field of page.fields) {
      // Only include DEFAULT/CUSTOM fields that are included
      if (field.protection === 'LOCKED') continue
      if (!field.isIncluded) continue
      allFields.push(field)
    }
  }

  // Also check loose fields
  if (!pageTitle) {
    for (const field of form.fields) {
      if (field.protection === 'LOCKED') continue
      if (!field.isIncluded) continue
      allFields.push(field)
    }
  }

  return allFields.sort((a, b) => a.sortOrder - b.sortOrder)
}
