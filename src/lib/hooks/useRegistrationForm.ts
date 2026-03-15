'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DiscountCode {
  code: string
  percentOff: number | null
  amountOff: number | null
  maxUses: number | null
  usedCount: number
}

export interface FormConfig {
  id: string
  title: string | null
  requiresPayment: boolean
  basePrice: number | null
  depositPercent: number | null
  maxCapacity: number | null
  waitlistEnabled: boolean
  requiresCoppaConsent: boolean
  openAt: string | null
  closeAt: string | null
  shareSlug: string
  discountCodes: DiscountCode[] | null
}

export interface FormField {
  id?: string
  fieldType: 'COMMON' | 'CUSTOM'
  fieldKey: string | null
  inputType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX' | 'NUMBER' | 'DATE' | 'FILE' | 'SIGNATURE'
  label: string
  helpText: string | null
  placeholder: string | null
  required: boolean
  enabled: boolean
  options: Array<{ label: string; value: string }> | null
  sortOrder: number
}

export interface FormSection {
  id?: string
  title: string
  description: string | null
  sortOrder: number
  fields: FormField[]
}

export interface RegistrationFormData {
  form: FormConfig | null
  sections: FormSection[]
}

// ─── Create Form Input ──────────────────────────────────────────────────────────

export interface CreateRegistrationFormInput {
  title?: string
  shareSlug?: string
  requiresPayment?: boolean
  requiresCoppaConsent?: boolean
}

// ─── Update Form Input ──────────────────────────────────────────────────────────

export interface UpdateRegistrationFormInput {
  form?: Partial<Omit<FormConfig, 'id'>>
  sections?: FormSection[]
}

// ─── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the registration form config, sections, and fields for an event project.
 * Returns null data when no form has been created yet.
 */
export function useRegistrationForm(eventProjectId: string) {
  return useQuery<RegistrationFormData | null>({
    queryKey: ['registration-form', eventProjectId],
    queryFn: async () => {
      try {
        return await fetchApi<RegistrationFormData>(`/api/events/projects/${eventProjectId}/registration-config`)
      } catch (err: unknown) {
        // 404 means no form exists yet — return null (not an error)
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'NOT_FOUND') {
          return null
        }
        throw err
      }
    },
    enabled: !!eventProjectId,
    staleTime: 60_000,
  })
}

/**
 * Create a new registration form for the event project.
 * Invalidates the registration form query on success.
 */
export function useCreateRegistrationForm(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRegistrationFormInput) =>
      fetchApi<FormConfig>(`/api/events/projects/${eventProjectId}/registration-config`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-form', eventProjectId] })
    },
  })
}

/**
 * Update the registration form config and/or sections for an event project.
 * Invalidates the registration form query on success.
 */
export function useUpdateRegistrationForm(eventProjectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateRegistrationFormInput) =>
      fetchApi<RegistrationFormData>(`/api/events/projects/${eventProjectId}/registration-config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-form', eventProjectId] })
    },
  })
}
