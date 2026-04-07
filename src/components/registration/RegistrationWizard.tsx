'use client'

/**
 * RegistrationWizard — Multi-step registration form for parents.
 *
 * Step flow:
 * 1. [Optional] COPPA consent interstitial (when form.requiresCoppaConsent)
 * 2. One wizard step per form section (ordered by sortOrder)
 * 3. [Optional] PaymentStep (when form.requiresPayment)
 * 4. Review + Turnstile + Submit
 *
 * Field types supported: TEXT, NUMBER, DATE, DROPDOWN, CHECKBOX, FILE, SIGNATURE
 *
 * FILE fields: upload via signed URL to /api/events/register/{shareSlug}/upload,
 * then store the returned publicUrl in form data.
 *
 * COPPA: captures timestamp and IP (IP set server-side on submission).
 *
 * Turnstile: token collected on the final review step before submit.
 */

import { useReducer, useCallback, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import PaymentStep from './PaymentStep'
import { type TurnstileWidgetRef } from './TurnstileWidget'
import FieldRenderer from './FieldRenderer'
import { CoppaStep, ReviewStep, ProgressIndicator, SuccessScreen } from './wizard-steps'
import type {
  FormConfig,
  FormSection,
  DiscountCode,
} from '@/lib/hooks/useRegistrationForm'
import type { FieldData } from './wizard-types'
import {
  slideVariants,
  wizardReducer,
  buildSteps,
  buildSubmissionPayload,
} from './wizard-types'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RegistrationWizardProps {
  shareSlug: string
  form: FormConfig
  sections: FormSection[]
  orgBranding: {
    logoUrl?: string | null
    primaryColor?: string
    name: string
  }
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function RegistrationWizard({
  shareSlug,
  form,
  sections,
  orgBranding,
}: RegistrationWizardProps) {
  const primaryColor = orgBranding.primaryColor ?? '#6366f1'
  const turnstileRef = useRef<TurnstileWidgetRef | null>(null) as React.MutableRefObject<TurnstileWidgetRef | null>
  const [submitting, setSubmitting] = useState(false)

  // Build step list: [coppa?] + sections + [payment?] + review
  const wizardSteps = buildSteps(form, sections)

  const [state, dispatch] = useReducer(wizardReducer, {
    step: 0,
    direction: 1,
    formData: {},
    coppaConsented: !form.requiresCoppaConsent,
    coppaConsentAt: null,
    turnstileToken: null,
    registrationId: null,
    submitted: false,
    error: null,
  })

  // Auto-save draft to server on form data changes (debounced)
  const saveDraft = useCallback(
    async (formData: Record<string, FieldData>) => {
      // Fire-and-forget — don't block UI
      try {
        const payload = buildSubmissionPayload(state, form, sections, formData, true)
        await fetch(`/api/events/register/${shareSlug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, draft: true, turnstileToken: 'draft-save' }),
        })
      } catch {
        // Draft save failures are silent
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shareSlug, form, sections],
  )

  // Debounce auto-save
  useEffect(() => {
    if (Object.keys(state.formData).length === 0) return
    const timer = setTimeout(() => {
      void saveDraft(state.formData)
    }, 2000)
    return () => clearTimeout(timer)
  }, [state.formData, saveDraft])

  // Handlers
  const handleFieldUpdate = useCallback(
    (fieldId: string, data: Partial<FieldData>) => {
      dispatch({ type: 'SET_FIELD', fieldId, data })
    },
    [],
  )

  const handleNext = useCallback(() => {
    const currentStepDef = wizardSteps[state.step]

    // Validate required fields on current section step
    if (currentStepDef.type === 'section') {
      const sectionId = currentStepDef.sectionId
      const section = sections.find((s) => s.id === sectionId)
      if (section) {
        for (const field of section.fields) {
          if (!field.required || !field.enabled) continue
          const id = field.id ?? ''
          const d = state.formData[id]

          let empty = false
          if (field.inputType === 'CHECKBOX') {
            empty = !d || d.values.length === 0
          } else if (field.inputType === 'SIGNATURE') {
            empty = !d?.signature?.data
          } else if (field.inputType === 'FILE') {
            empty = !d?.fileUrl
          } else {
            empty = !d?.value?.trim()
          }

          if (empty) {
            dispatch({ type: 'SET_ERROR', error: `"${field.label}" is required.` })
            return
          }
        }
      }
    }

    dispatch({ type: 'NEXT', totalSteps: wizardSteps.length })
  }, [state.step, state.formData, wizardSteps, sections])

  const handleBack = useCallback(() => {
    dispatch({ type: 'BACK' })
  }, [])

  const handleCoppaConsent = useCallback(() => {
    dispatch({ type: 'SET_COPPA', consentAt: new Date().toISOString() })
    dispatch({ type: 'NEXT', totalSteps: wizardSteps.length })
  }, [wizardSteps.length])

  const handleSubmit = useCallback(async () => {
    if (!state.turnstileToken) return

    setSubmitting(true)
    dispatch({ type: 'SET_ERROR', error: null })

    try {
      const payload = buildSubmissionPayload(state, form, sections, state.formData, false)

      const res = await fetch(`/api/events/register/${shareSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json() as {
        ok: boolean
        data?: { registration: { id: string }; requiresPayment: boolean }
        error?: { message: string }
      }

      if (!json.ok) {
        const msg = json.error?.message ?? 'Submission failed. Please try again.'
        dispatch({ type: 'SET_ERROR', error: msg })
        // Reset Turnstile so user can try again
        turnstileRef.current?.reset()
        dispatch({ type: 'SET_TURNSTILE', token: '' as unknown as string })
        return
      }

      const registrationId = json.data?.registration?.id ?? null
      if (registrationId) {
        dispatch({ type: 'SET_REGISTRATION_ID', id: registrationId })
      }

      if (json.data?.requiresPayment) {
        // Advance to payment step (handled by render)
        dispatch({ type: 'NEXT', totalSteps: wizardSteps.length })
      } else {
        dispatch({ type: 'SET_SUBMITTED' })
      }
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'Network error. Please check your connection.' })
    } finally {
      setSubmitting(false)
    }
  }, [state, form, sections, shareSlug, wizardSteps.length])

  // Success screen
  if (state.submitted) {
    return <SuccessScreen orgName={orgBranding.name} primaryColor={primaryColor} />
  }

  const currentStepDef = wizardSteps[state.step]
  const stepLabels = wizardSteps.map((s) => s.label)
  const isFirstStep = state.step === 0
  const isLastStep = state.step === wizardSteps.length - 1

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <ProgressIndicator
        steps={stepLabels}
        currentStep={state.step}
        primaryColor={primaryColor}
      />

      {/* Step content */}
      <AnimatePresence mode="wait" custom={state.direction}>
        <motion.div
          key={state.step}
          custom={state.direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* COPPA step */}
          {currentStepDef.type === 'coppa' && (
            <CoppaStep orgName={orgBranding.name} onConsent={handleCoppaConsent} />
          )}

          {/* Section step */}
          {currentStepDef.type === 'section' && (() => {
            const section = sections.find((s) => s.id === currentStepDef.sectionId)
            if (!section) return null
            return (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                  {section.description && (
                    <p className="text-sm text-slate-500 mt-1">{section.description}</p>
                  )}
                </div>

                {section.fields
                  .filter((f) => f.enabled)
                  .map((field) => {
                    const id = field.id ?? ''
                    const fieldData: FieldData = state.formData[id] ?? {
                      value: '',
                      values: [],
                      fileUrl: '',
                      signature: null,
                    }
                    return (
                      <FieldRenderer
                        key={id}
                        field={field}
                        data={fieldData}
                        onUpdate={(data) => handleFieldUpdate(id, data)}
                        shareSlug={shareSlug}
                      />
                    )
                  })}

                {state.error && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {state.error}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Payment step */}
          {currentStepDef.type === 'payment' && state.registrationId && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Payment</h2>
              <PaymentStep
                registrationId={state.registrationId}
                shareSlug={shareSlug}
                amount={form.basePrice ?? 0}
                depositPercent={form.depositPercent}
                discountCodes={form.discountCodes as DiscountCode[] | null}
                orgPrimaryColor={primaryColor}
                onPaymentSuccess={() => dispatch({ type: 'SET_SUBMITTED' })}
                onPaymentError={(msg) => dispatch({ type: 'SET_ERROR', error: msg })}
                returnUrl={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/events/portal`
                    : '/events/portal'
                }
              />
            </div>
          )}

          {/* Review + submit step */}
          {currentStepDef.type === 'review' && (
            <ReviewStep
              sections={sections}
              formData={state.formData}
              turnstileToken={state.turnstileToken}
              onTurnstileSuccess={(token) =>
                dispatch({ type: 'SET_TURNSTILE', token })
              }
              onSubmit={handleSubmit}
              submitting={submitting}
              error={state.error}
              primaryColor={primaryColor}
              turnstileRef={turnstileRef}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation (not shown on coppa/review/payment steps — those have own buttons) */}
      {currentStepDef.type === 'section' && (
        <div className="flex items-center justify-between pt-2">
          {!isFirstStep ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer active:scale-[0.97]"
            style={{ backgroundColor: primaryColor }}
          >
            {isLastStep ? 'Review' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Back nav for review step */}
      {currentStepDef.type === 'review' && (
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Edit responses
        </button>
      )}
    </div>
  )
}
