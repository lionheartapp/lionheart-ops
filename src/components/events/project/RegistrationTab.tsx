'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Users, Share2, Loader2 } from 'lucide-react'
import { fadeInUp, tabContent } from '@/lib/animations'
import { useRegistrationForm, useCreateRegistrationForm } from '@/lib/hooks/useRegistrationForm'
import { FormBuilder } from '@/components/registration/FormBuilder'
import { useToast } from '@/components/Toast'
import { COMMON_FIELDS } from '@/components/registration/CommonFieldPicker'
import { RegistrationManagement } from './RegistrationManagement'
import { ShareHub } from './ShareHub'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RegistrationTabProps {
  eventProjectId: string
}

// ─── Sub-tab types ─────────────────────────────────────────────────────────────

type SubTab = 'form' | 'registrations' | 'share'

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'form', label: 'Form Design', icon: ClipboardList },
  { id: 'registrations', label: 'Registrations', icon: Users },
  { id: 'share', label: 'Share & Publish', icon: Share2 },
]

// ─── Default section with always-on fields ────────────────────────────────────

// Keep this for compatibility with existing create flow
export function buildDefaultSections() {
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

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegistrationTab({ eventProjectId }: RegistrationTabProps) {
  const { data: formData, isLoading } = useRegistrationForm(eventProjectId)
  const createMutation = useCreateRegistrationForm(eventProjectId)
  const { toast } = useToast()
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('form')

  async function handleSetUpRegistration() {
    try {
      await createMutation.mutateAsync({})
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

  // Form exists — show sub-tabs
  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === activeSubTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Sub-tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          variants={tabContent}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {activeSubTab === 'form' && (
            <FormBuilder eventProjectId={eventProjectId} />
          )}
          {activeSubTab === 'registrations' && (
            <RegistrationManagement eventProjectId={eventProjectId} />
          )}
          {activeSubTab === 'share' && (
            <ShareHub eventProjectId={eventProjectId} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
