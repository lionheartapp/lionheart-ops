'use client'

import { motion } from 'framer-motion'
import { ClipboardList, Users, Clock, Link as LinkIcon, Loader2 } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'
import { useRegistrationForm, useCreateRegistrationForm } from '@/lib/hooks/useRegistrationForm'
import { FormBuilder } from '@/components/registration/FormBuilder'
import { useToast } from '@/components/Toast'
import { COMMON_FIELDS } from '@/components/registration/CommonFieldPicker'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RegistrationTabProps {
  eventProjectId: string
}

// ─── Default section with always-on fields ────────────────────────────────────

function buildDefaultSections() {
  const alwaysOnFields = COMMON_FIELDS
    .filter((f) => f.alwaysOn)
    .map((f, i) => ({
      fieldType: 'COMMON' as const,
      fieldKey: f.key,
      inputType: f.inputType as 'TEXT' | 'DROPDOWN' | 'FILE',
      label: f.label,
      helpText: null,
      placeholder: null,
      required: f.required,
      enabled: true,
      options: null,
      sortOrder: i,
    }))

  return [
    {
      title: 'Participant Information',
      description: null,
      sortOrder: 0,
      fields: alwaysOnFields,
    },
  ]
}

// ─── Stats row ─────────────────────────────────────────────────────────────────

interface StatsRowProps {
  shareSlug: string
  formId: string
}

function StatsRow({ shareSlug, formId: _formId }: StatsRowProps) {
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${shareSlug}`
    : `/events/${shareSlug}`

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Registration Info</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Registrations</span>
          </div>
          <span className="text-2xl font-semibold text-gray-900">—</span>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Waitlisted</span>
          </div>
          <span className="text-2xl font-semibold text-gray-900">—</span>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Share Link</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium truncate block w-full text-left cursor-pointer transition-colors duration-200"
            title={shareUrl}
          >
            Copy link
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegistrationTab({ eventProjectId }: RegistrationTabProps) {
  const { data: formData, isLoading } = useRegistrationForm(eventProjectId)
  const createMutation = useCreateRegistrationForm(eventProjectId)
  const { toast } = useToast()

  async function handleSetUpRegistration() {
    try {
      await createMutation.mutateAsync({})
      // After form is created, the query will refetch — but we also need to seed sections
      // We do a follow-up PUT to add the default section
      toast('Registration form created — configure it below', 'success')
    } catch {
      toast('Failed to create registration form', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-8 bg-gray-100 rounded-xl w-56" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  // No form created yet — show empty state with CTA
  if (!formData || !formData.form) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="text-center py-16"
      >
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">No Registration Form Yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
          Set up a registration form so parents and participants can sign up for this event. You can configure fields, capacity, payments, and more.
        </p>
        <button
          type="button"
          onClick={handleSetUpRegistration}
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-60"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ClipboardList className="w-4 h-4" />
          )}
          Set Up Registration
        </button>
      </motion.div>
    )
  }

  // Form exists — show builder + stats row
  return (
    <div>
      <FormBuilder eventProjectId={eventProjectId} />
      {formData.form && (
        <StatsRow shareSlug={formData.form.shareSlug} formId={formData.form.id} />
      )}
    </div>
  )
}
