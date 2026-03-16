'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Users, Share2, Loader2, Sparkles, X } from 'lucide-react'
import { fadeInUp, tabContent } from '@/lib/animations'
import {
  useRegistrationForm,
  useCreateRegistrationForm,
  useUpdateRegistrationForm,
  type FormSection,
  type FormField,
} from '@/lib/hooks/useRegistrationForm'
import { FormBuilder } from '@/components/registration/FormBuilder'
import { useToast } from '@/components/Toast'
import { COMMON_FIELDS } from '@/components/registration/CommonFieldPicker'
import { RegistrationManagement } from './RegistrationManagement'
import { ShareHub } from './ShareHub'
import type { AIFormSection } from '@/lib/types/event-ai'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RegistrationTabProps {
  eventProjectId: string
  eventType?: string
  durationDays?: number
  expectedAttendance?: number
  description?: string
}

// ─── Sub-tab types ─────────────────────────────────────────────────────────────

type SubTab = 'form' | 'registrations' | 'share'

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'form', label: 'Form Design', icon: ClipboardList },
  { id: 'registrations', label: 'Registrations', icon: Users },
  { id: 'share', label: 'Share & Publish', icon: Share2 },
]

// ─── Default section with always-on fields ────────────────────────────────────

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

// ─── Convert AI sections to FormSection shape ──────────────────────────────────

function aiSectionsToFormSections(aiSections: AIFormSection[]): FormSection[] {
  return aiSections.map((section, sectionIndex) => {
    const fields: FormField[] = section.fields.map((field, fieldIndex) => ({
      fieldType: 'CUSTOM' as const,
      fieldKey: null,
      inputType: field.type === 'FILE'
        ? 'FILE'
        : field.type === 'DATE'
        ? 'DATE'
        : field.type === 'NUMBER'
        ? 'NUMBER'
        : field.type === 'CHECKBOX'
        ? 'CHECKBOX'
        : field.type === 'DROPDOWN'
        ? 'DROPDOWN'
        : 'TEXT',
      label: field.label,
      helpText: field.helpText ?? null,
      placeholder: null,
      required: field.required,
      enabled: true,
      options: field.options
        ? field.options.map((opt) => ({ label: opt, value: opt }))
        : null,
      sortOrder: fieldIndex,
    }))

    return {
      title: section.title,
      description: null,
      sortOrder: sectionIndex,
      fields,
    }
  })
}

// ─── AI Generate Form Modal ────────────────────────────────────────────────────

interface AIGenerateModalProps {
  defaultEventType: string
  defaultDescription: string
  onClose: () => void
  onGenerate: (eventType: string, description: string) => void
  generating: boolean
}

function AIGenerateModal({
  defaultEventType,
  defaultDescription,
  onClose,
  onGenerate,
  generating,
}: AIGenerateModalProps) {
  const [eventType, setEventType] = useState(defaultEventType)
  const [description, setDescription] = useState(defaultDescription)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Generate Form with AI</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          AI will suggest form sections and fields based on the event type. Review and edit before saving.
        </p>

        {/* Event type */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Event type
            </label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. Summer Camp, Field Trip, Retreat"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Special requirements{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Overnight event requiring medical forms, dietary needs collection"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 rounded-full text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(eventType, description)}
            disabled={generating || !eventType.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : 'Generate Form'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegistrationTab({
  eventProjectId,
  eventType = '',
  durationDays = 1,
  expectedAttendance = 50,
  description = '',
}: RegistrationTabProps) {
  const { data: formData, isLoading } = useRegistrationForm(eventProjectId)
  const createMutation = useCreateRegistrationForm(eventProjectId)
  const updateMutation = useUpdateRegistrationForm(eventProjectId)
  const { toast } = useToast()
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('form')
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiGenerating, setAIGenerating] = useState(false)

  async function handleSetUpRegistration() {
    try {
      await createMutation.mutateAsync({})
      toast('Registration form created — configure it below', 'success')
    } catch {
      toast('Failed to create registration form', 'error')
    }
  }

  async function handleAIGenerate(evtType: string, evtDescription: string) {
    setAIGenerating(true)
    try {
      const res = await fetch('/api/events/ai/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: evtType,
          durationDays,
          expectedAttendance,
          description: evtDescription || undefined,
        }),
      })
      const json = await res.json()
      if (json.ok && json.data?.sections) {
        // Convert AI sections to FormSection shape and save to the form
        const newSections = aiSectionsToFormSections(json.data.sections)
        await updateMutation.mutateAsync({ sections: newSections })
        setShowAIModal(false)
        toast(
          `AI generated ${json.data.sections.length} form sections — review and edit as needed`,
          'success',
        )
        setActiveSubTab('form')
      } else {
        toast(json.error?.message ?? 'Failed to generate form', 'error')
      }
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setAIGenerating(false)
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

  // No form created yet — show empty state with CTAs
  if (!formData || !formData.form) {
    return (
      <>
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
            Set up a registration form so parents and participants can sign up for this event. You
            can configure fields, capacity, payments, and more.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
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
            <button
              type="button"
              onClick={async () => {
                // Create form first, then open AI modal
                try {
                  await createMutation.mutateAsync({})
                  setShowAIModal(true)
                } catch {
                  toast('Failed to create registration form', 'error')
                }
              }}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showAIModal && (
            <AIGenerateModal
              defaultEventType={eventType}
              defaultDescription={description}
              onClose={() => setShowAIModal(false)}
              onGenerate={handleAIGenerate}
              generating={aiGenerating}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  // Form exists — show sub-tabs
  return (
    <>
      <div>
        {/* Sub-tab bar with AI generate button */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
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

          {/* AI generate button (only visible on form tab) */}
          {activeSubTab === 'form' && (
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 active:scale-[0.97] transition-all cursor-pointer"
              title={
                formData.sections.length > 0
                  ? 'Clear existing form fields to regenerate with AI'
                  : 'Generate form fields with AI'
              }
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          )}
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

      <AnimatePresence>
        {showAIModal && (
          <AIGenerateModal
            defaultEventType={eventType}
            defaultDescription={description}
            onClose={() => setShowAIModal(false)}
            onGenerate={handleAIGenerate}
            generating={aiGenerating}
          />
        )}
      </AnimatePresence>
    </>
  )
}
