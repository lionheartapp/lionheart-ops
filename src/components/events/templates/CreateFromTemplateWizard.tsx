'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  CheckCircle,
  Calendar,
  ClipboardList,
  DollarSign,
  FileText,
  Users,
  Bell,
} from 'lucide-react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { useTemplate, useTemplateMutations } from '@/lib/hooks/useEventTemplates'
import { useToast } from '@/components/Toast'
import { fetchApi } from '@/lib/api-client'
import { tabContent } from '@/lib/animations'
import type { TemplateData } from '@/lib/types/event-template'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateFromTemplateWizardProps {
  templateId: string
  isOpen: boolean
  onClose: () => void
}

type Step = 1 | 2 | 3

interface EventDetails {
  title: string
  startsAt: string
  endsAt: string
  locationText: string
}

interface AIEnhancements {
  scheduleAdjusted: boolean
  budgetUpdated: boolean
  lessonsFound: string[]
  includeSchedule: boolean
  includeBudget: boolean
  includeLessons: boolean
}

const EMPTY_DETAILS: EventDetails = {
  title: '',
  startsAt: '',
  endsAt: '',
  locationText: '',
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  1: 'Event Details',
  2: 'AI Enhancements',
  3: 'Confirm',
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (i + 1) as Step).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              step < current
                ? 'bg-indigo-500 text-white'
                : step === current
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {step < current ? <CheckCircle className="w-4 h-4" /> : step}
          </div>
          <span
            className={`text-sm font-medium ${
              step === current ? 'text-indigo-700' : 'text-slate-400'
            }`}
          >
            {STEP_LABELS[step]}
          </span>
          {step < total && <div className="w-8 h-px bg-slate-200 mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Event Details ────────────────────────────────────────────────────

interface Step1Props {
  details: EventDetails
  onChange: (details: EventDetails) => void
}

function Step1({ details, onChange }: Step1Props) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="new-event-title" className="block text-sm font-medium text-slate-700 mb-1">
          Event Title <span className="text-red-500">*</span>
        </label>
        <input
          id="new-event-title"
          type="text"
          value={details.title}
          onChange={(e) => onChange({ ...details, title: e.target.value })}
          placeholder="e.g. Camp Big Bear 2026"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="new-event-starts" className="block text-sm font-medium text-slate-700 mb-1">
            Start Date & Time <span className="text-red-500">*</span>
          </label>
          <input
            id="new-event-starts"
            type="datetime-local"
            value={details.startsAt}
            onChange={(e) => onChange({ ...details, startsAt: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          />
        </div>
        <div>
          <label htmlFor="new-event-ends" className="block text-sm font-medium text-slate-700 mb-1">
            End Date & Time <span className="text-red-500">*</span>
          </label>
          <input
            id="new-event-ends"
            type="datetime-local"
            value={details.endsAt}
            onChange={(e) => onChange({ ...details, endsAt: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          />
        </div>
      </div>

      <div>
        <label htmlFor="new-event-location" className="block text-sm font-medium text-slate-700 mb-1">
          Location <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="new-event-location"
          type="text"
          value={details.locationText}
          onChange={(e) => onChange({ ...details, locationText: e.target.value })}
          placeholder="e.g. Camp Sherwood, Malibu CA"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        />
      </div>
    </div>
  )
}

// ─── Step 2: AI Enhancements ──────────────────────────────────────────────────

interface Step2Props {
  enhancements: AIEnhancements | null
  isLoading: boolean
  onChange: (enhancements: AIEnhancements) => void
}

function Step2({ enhancements, isLoading, onChange }: Step2Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Analyzing template...</p>
            <p className="text-xs text-slate-500">AI is adjusting dates and reviewing lessons learned</p>
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="ui-glass p-4 rounded-xl animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!enhancements) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700 mb-1">AI not available</p>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Continuing without AI enhancements. The template structure will be applied as-is.
        </p>
      </div>
    )
  }

  function toggle(field: 'includeSchedule' | 'includeBudget' | 'includeLessons') {
    if (!enhancements) return
    onChange({ ...enhancements, [field]: !enhancements[field] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <p className="text-sm font-medium text-slate-900">AI-powered enhancements ready</p>
      </div>

      {/* Schedule adjustment */}
      <label className="flex items-start gap-3 ui-glass p-4 rounded-xl cursor-pointer hover:bg-white/70 transition-colors">
        <input
          type="checkbox"
          checked={enhancements.includeSchedule}
          onChange={() => toggle('includeSchedule')}
          className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <p className="text-sm font-medium text-slate-900">Schedule adjusted to new dates</p>
          </div>
          <p className="text-xs text-slate-500">
            {enhancements.scheduleAdjusted
              ? 'Day offsets recalculated and timing optimized for your new dates.'
              : 'Schedule blocks preserved from the original template.'}
          </p>
        </div>
      </label>

      {/* Budget */}
      <label className="flex items-start gap-3 ui-glass p-4 rounded-xl cursor-pointer hover:bg-white/70 transition-colors">
        <input
          type="checkbox"
          checked={enhancements.includeBudget}
          onChange={() => toggle('includeBudget')}
          className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <p className="text-sm font-medium text-slate-900">Budget categories included</p>
          </div>
          <p className="text-xs text-slate-500">
            {enhancements.budgetUpdated
              ? 'Budget categories reviewed and updated for current conditions.'
              : 'Budget category structure preserved from original template.'}
          </p>
        </div>
      </label>

      {/* Lessons learned */}
      {enhancements.lessonsFound.length > 0 && (
        <label className="flex items-start gap-3 ui-glass p-4 rounded-xl cursor-pointer hover:bg-white/70 transition-colors">
          <input
            type="checkbox"
            checked={enhancements.includeLessons}
            onChange={() => toggle('includeLessons')}
            className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardList className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <p className="text-sm font-medium text-slate-900">
                Lessons from previous event
              </p>
            </div>
            <ul className="space-y-1">
              {enhancements.lessonsFound.slice(0, 4).map((lesson, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span>
                  {lesson}
                </li>
              ))}
            </ul>
          </div>
        </label>
      )}
    </div>
  )
}

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

const SECTION_ICONS = [
  { icon: Calendar, label: 'Schedule structure' },
  { icon: ClipboardList, label: 'Task templates' },
  { icon: DollarSign, label: 'Budget categories' },
  { icon: FileText, label: 'Document requirements' },
  { icon: Users, label: 'Group structure' },
  { icon: Bell, label: 'Notification rules' },
]

interface Step3Props {
  details: EventDetails
  templateName: string
}

function Step3({ details, templateName }: Step3Props) {
  const startsAt = details.startsAt ? new Date(details.startsAt) : null
  const endsAt = details.endsAt ? new Date(details.endsAt) : null

  function formatDateTime(date: Date) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      <div className="ui-glass p-4 rounded-xl space-y-3">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Event Title</p>
          <p className="text-sm font-semibold text-slate-900">{details.title}</p>
        </div>
        {startsAt && endsAt && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Dates</p>
            <p className="text-sm text-slate-900">
              {formatDateTime(startsAt)} &ndash; {formatDateTime(endsAt)}
            </p>
          </div>
        )}
        {details.locationText && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Location</p>
            <p className="text-sm text-slate-900">{details.locationText}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Template</p>
          <p className="text-sm text-slate-900">{templateName}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          What will be created
        </p>
        <div className="space-y-2">
          {SECTION_ICONS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-3 h-3 text-green-600" aria-hidden="true" />
              </div>
              <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-slate-700">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
        The new event will start in Draft status. Participant data and personal information
        are not copied from the source event.
      </p>
    </div>
  )
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

export function CreateFromTemplateWizard({
  templateId,
  isOpen,
  onClose,
}: CreateFromTemplateWizardProps) {
  const router = useRouter()
  const focusTrapRef = useFocusTrap(isOpen)
  const { toast } = useToast()
  const { createFromTemplate } = useTemplateMutations()

  const [step, setStep] = useState<Step>(1)
  const [details, setDetails] = useState<EventDetails>(EMPTY_DETAILS)
  const [enhancements, setEnhancements] = useState<AIEnhancements | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data: template, isLoading: templateLoading } = useTemplate(isOpen ? templateId : null)

  // Reset wizard on open
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setDetails(EMPTY_DETAILS)
      setEnhancements(null)
      setAiLoading(false)
      setErrorMsg(null)
      setIsCreating(false)
    }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ─── Step navigation ───────────────────────────────────────────────

  const canGoToStep2 = details.title.trim() && details.startsAt && details.endsAt

  async function goToStep2() {
    if (!canGoToStep2 || !template) return
    setStep(2)
    setAiLoading(true)

    try {
      const enhanced = await fetchApi<TemplateData>('/api/events/ai/enhance-template', {
        method: 'POST',
        body: JSON.stringify({
          templateData: template.templateData,
          startsAt: new Date(details.startsAt).toISOString(),
          endsAt: new Date(details.endsAt).toISOString(),
        }),
      })

      setEnhancements({
        scheduleAdjusted: enhanced.scheduleBlocks.length > 0,
        budgetUpdated: enhanced.budgetCategories.length > 0,
        lessonsFound: [],
        includeSchedule: true,
        includeBudget: true,
        includeLessons: true,
      })
    } catch {
      // AI not available — continue without enhancements
      setEnhancements(null)
    } finally {
      setAiLoading(false)
    }
  }

  function goToStep3() {
    setStep(3)
  }

  async function handleCreate() {
    if (!details.title.trim() || !details.startsAt || !details.endsAt) {
      setErrorMsg('Please fill in all required fields.')
      return
    }
    setErrorMsg(null)
    setIsCreating(true)

    try {
      const result = await createFromTemplate.mutateAsync({
        templateId,
        input: {
          title: details.title.trim(),
          startsAt: new Date(details.startsAt).toISOString(),
          endsAt: new Date(details.endsAt).toISOString(),
          locationText: details.locationText.trim() || undefined,
        },
      })

      toast('Event created from template!', 'success')
      onClose()
      router.push(`/events/${result.eventProjectId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event'
      setErrorMsg(message)
      setIsCreating(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <motion.div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-from-template-title"
          className="relative w-full max-w-xl transform overflow-hidden rounded-2xl ui-glass-overlay"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close wizard"
          >
            <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
          </button>

          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-4">
              <h3 id="create-from-template-title" className="text-xl font-semibold text-slate-900">
                Create from Template
              </h3>
              {template && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Using: <span className="font-medium text-slate-700">{template.name}</span>
                </p>
              )}
            </div>

            {/* Step Indicator */}
            <StepIndicator current={step} total={3} />

            {/* Step Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={tabContent}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {templateLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-10 bg-slate-200 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-10 bg-slate-200 rounded-xl" />
                      <div className="h-10 bg-slate-200 rounded-xl" />
                    </div>
                  </div>
                ) : step === 1 ? (
                  <Step1 details={details} onChange={setDetails} />
                ) : step === 2 ? (
                  <Step2
                    enhancements={enhancements}
                    isLoading={aiLoading}
                    onChange={setEnhancements}
                  />
                ) : (
                  <Step3
                    details={details}
                    templateName={template?.name ?? 'Template'}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Error */}
            {errorMsg && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center gap-3">
              {/* Back */}
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  disabled={isCreating}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Back
                </button>
              )}

              <div className="flex-1" />

              {/* Cancel (step 1 only) */}
              {step === 1 && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {/* Next / Create */}
              {step === 1 && (
                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!canGoToStep2 || templateLoading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={goToStep3}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiLoading ? 'Loading...' : 'Continue'}
                  {!aiLoading && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create Event'}
                  {!isCreating && <CheckCircle className="w-4 h-4" aria-hidden="true" />}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
