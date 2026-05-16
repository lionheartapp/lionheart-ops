'use client'

import { useState, useMemo } from 'react'
import { Loader2, Inbox } from 'lucide-react'
import { useEventForm } from '@/lib/hooks/useEventForm'
import FormSubmissionsTable from '@/components/forms/submissions/FormSubmissionsTable'
import FormSubmissionDetail from '@/components/forms/submissions/FormSubmissionDetail'
import type { FormSubmission } from '@/lib/hooks/useFormSubmissions'

interface EventResponsesTabProps {
  eventProjectId: string
}

export function EventResponsesTab({ eventProjectId }: EventResponsesTabProps) {
  const { data: eventForm, isLoading } = useEventForm(eventProjectId)
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)

  // Build field columns from the form definition
  const { fieldColumns, fieldDefs } = useMemo(() => {
    if (!eventForm) return { fieldColumns: [], fieldDefs: [] }

    const cols: Array<{ key: string; label: string }> = []
    const defs: Array<{ key: string; label: string; type: string }> = []

    for (const page of eventForm.pages ?? []) {
      for (const field of page.fields ?? []) {
        if (field.type === 'HEADER' || field.type === 'DIVIDER') continue
        cols.push({ key: field.key, label: field.label })
        defs.push({ key: field.key, label: field.label, type: field.type })
      }
    }

    // Loose fields
    for (const field of eventForm.fields ?? []) {
      if (field.type === 'HEADER' || field.type === 'DIVIDER') continue
      if (!cols.some((c) => c.key === field.key)) {
        cols.push({ key: field.key, label: field.label })
        defs.push({ key: field.key, label: field.label, type: field.type })
      }
    }

    return { fieldColumns: cols, fieldDefs: defs }
  }, [eventForm])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!eventForm) {
    return (
      <div className="text-center py-16">
        <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No form associated with this event yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Open the event overview and click &ldquo;Customize Form&rdquo; to create one.
        </p>
      </div>
    )
  }

  return (
    <div>
      <FormSubmissionsTable
        formId={eventForm.id}
        fieldColumns={fieldColumns}
        onSelect={setSelectedSubmission}
        maxFieldColumns={3}
      />

      <FormSubmissionDetail
        submission={selectedSubmission}
        formId={eventForm.id}
        fieldDefs={fieldDefs}
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
      />
    </div>
  )
}
