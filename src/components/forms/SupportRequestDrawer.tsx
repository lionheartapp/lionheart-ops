'use client'

import { useState, useMemo, useCallback } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { DynamicFormRenderer } from '@/components/forms/renderer'
import type { DynamicPage, DynamicField } from '@/components/forms/renderer/DynamicFormRenderer'
import { useSystemForm } from '@/lib/hooks/useSystemForm'
import { useToast } from '@/components/Toast'
import { fetchApi } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketModule = 'MAINTENANCE' | 'IT'

interface SupportRequestDrawerProps {
  isOpen: boolean
  onClose: () => void
  /** Which ticket module to submit to */
  module: TicketModule
}

const MODULE_CONFIG: Record<TicketModule, {
  systemKey: string
  title: string
  submitEndpoint: string
  successMessage: string
}> = {
  MAINTENANCE: {
    systemKey: 'facilities_request',
    title: 'New Facilities Request',
    submitEndpoint: '/api/maintenance/tickets',
    successMessage: 'Facilities request submitted',
  },
  IT: {
    systemKey: 'it_request',
    title: 'New IT Request',
    submitEndpoint: '/api/it/tickets',
    successMessage: 'IT request submitted',
  },
}

// Map system form field keys to the ticket API field names.
// Keys here match the field.key values in system-form-seeds.ts.
// LOCKED fields are required by the ticket APIs and can't be removed by admins.
const FIELD_TO_TICKET_MAP: Record<string, string> = {
  // Shared (both Maintenance and IT)
  title: 'title',
  description: 'description',
  priority: 'priority',
  location: 'locationText',
  // Maintenance-specific
  category: 'category',          // LOCKED — required enum for routing
  requested_date: 'scheduledDate',
  photo: 'photos',
  requires_custodial: 'requiresCustodial',
  requires_security: 'requiresSecurity',
  // IT-specific
  issueType: 'issueType',        // LOCKED — required enum for routing
  device: 'assetId',
  screenshot: 'photos',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupportRequestDrawer({
  isOpen,
  onClose,
  module,
}: SupportRequestDrawerProps) {
  const config = MODULE_CONFIG[module]
  const { toast } = useToast()
  const { data: systemForm, isLoading: formLoading } = useSystemForm(isOpen ? config.systemKey : null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ ticketNumber?: string } | null>(null)

  // Build pages for DynamicFormRenderer from the system form
  const { pages, looseFields } = useMemo(() => {
    if (!systemForm) return { pages: [] as DynamicPage[], looseFields: [] as DynamicField[] }

    const mappedPages: DynamicPage[] = (systemForm.pages ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      sortOrder: p.sortOrder,
      isOptional: p.isOptional,
      condFieldKey: p.condFieldKey,
      condOperator: p.condOperator,
      condEquals: p.condEquals,
      fields: (p.fields ?? [])
        .filter((f) => f.isIncluded)
        .map((f) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type as DynamicField['type'],
          required: f.required,
          placeholder: f.placeholder,
          helpText: f.helpText,
          options: f.options,
          protection: f.protection as DynamicField['protection'],
          isIncluded: f.isIncluded,
          condFieldKey: f.condFieldKey,
          condOperator: f.condOperator,
          condEquals: f.condEquals,
          minValue: f.minValue,
          maxValue: f.maxValue,
          pattern: f.pattern,
          errorMessage: f.errorMessage,
          defaultValue: f.defaultValue,
        })),
    }))

    const loose: DynamicField[] = (systemForm.fields ?? [])
      .filter((f) => f.isIncluded)
      .map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type as DynamicField['type'],
        required: f.required,
        placeholder: f.placeholder,
        helpText: f.helpText,
        options: f.options,
        protection: f.protection as DynamicField['protection'],
        isIncluded: f.isIncluded,
        condFieldKey: f.condFieldKey,
        condOperator: f.condOperator,
        condEquals: f.condEquals,
      }))

    return { pages: mappedPages, looseFields: loose }
  }, [systemForm])

  const handleClose = useCallback(() => {
    setValues({})
    setSubmitted(null)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async (formValues: Record<string, unknown>) => {
    setIsSubmitting(true)

    try {
      // Map form field keys to the ticket API payload
      const payload: Record<string, unknown> = {}
      const customFields: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(formValues)) {
        if (value == null || value === '' || value === false) continue
        const ticketField = FIELD_TO_TICKET_MAP[key]
        if (ticketField) {
          payload[ticketField] = value
        } else {
          customFields[key] = value
        }
      }

      // Include custom fields in metadata
      if (Object.keys(customFields).length > 0) {
        payload.metadata = { customFields }
      }

      // Include the system form ID for tracking
      if (systemForm) {
        payload.systemFormId = systemForm.id
      }

      const result = await fetchApi<{ id: string; ticketNumber?: string }>(config.submitEndpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSubmitted({ ticketNumber: result.ticketNumber })
      toast(config.successMessage, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit request', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [config, systemForm, toast])

  // Success state
  if (submitted) {
    return (
      <DetailDrawer
        isOpen={isOpen}
        onClose={handleClose}
        title={config.title}
        width="lg"
        footer={
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        }
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Request Submitted</h3>
          {submitted.ticketNumber && (
            <p className="text-sm text-slate-500">Ticket #{submitted.ticketNumber}</p>
          )}
          <p className="text-sm text-slate-500 mt-2">
            Your request has been submitted and assigned to the appropriate team.
          </p>
        </div>
      </DetailDrawer>
    )
  }

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={config.title}
      width="lg"
    >
      {formLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      )}

      {!formLoading && systemForm && (
        <DynamicFormRenderer
          pages={pages}
          looseFields={looseFields}
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitLabel="Submit Request"
        />
      )}

      {!formLoading && !systemForm && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">Form not available. Please try again later.</p>
        </div>
      )}
    </DetailDrawer>
  )
}
