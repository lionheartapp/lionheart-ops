'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react'
import TurnstileWidget, { type TurnstileWidgetRef } from './TurnstileWidget'
import type { FormSection } from '@/lib/hooks/useRegistrationForm'
import type { FormData } from './wizard-types'
import { Checkbox } from '@/components/ui/Checkbox'

// ─── COPPA step ───────────────────────────────────────────────────────────────

interface CoppaStepProps {
  orgName: string
  onConsent: () => void
}

export function CoppaStep({ orgName, onConsent }: CoppaStepProps) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Parental Consent Required</p>
          <p className="text-sm text-blue-800">
            {orgName} collects personal information about the student participant
            in this registration form. In compliance with COPPA and applicable
            privacy laws, we require consent from a parent or legal guardian
            before collecting any personal information.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
          <Checkbox
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
        </div>
        <span className="text-sm text-slate-700 group-hover:text-slate-900 leading-relaxed">
          I confirm that I am the parent or legal guardian of the participant
          and consent to the collection and use of their personal information
          as described in this registration form.
        </span>
      </label>

      <button
        type="button"
        onClick={onConsent}
        disabled={!checked}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer active:scale-[0.97]"
      >
        I Agree — Continue to Registration
      </button>
    </div>
  )
}

// ─── Review step ──────────────────────────────────────────────────────────────

interface ReviewStepProps {
  sections: FormSection[]
  formData: FormData
  turnstileToken: string | null
  onTurnstileSuccess: (token: string) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
  primaryColor: string
  turnstileRef: React.MutableRefObject<TurnstileWidgetRef | null>
}

export function ReviewStep({
  sections,
  formData,
  turnstileToken,
  onTurnstileSuccess,
  onSubmit,
  submitting,
  error,
  primaryColor,
  turnstileRef,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Review your information</h2>
        <p className="text-sm text-slate-500 mt-1">
          Please review your responses before submitting.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            {section.title}
          </h3>
          <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100">
            {section.fields
              .filter((f) => f.enabled)
              .map((field) => {
                const id = field.id ?? ''
                const d = formData[id]
                let displayValue: string | null = null

                if (field.inputType === 'CHECKBOX') {
                  displayValue = d?.values?.join(', ') || '\u2014'
                } else if (field.inputType === 'SIGNATURE') {
                  displayValue = d?.signature
                    ? d.signature.type === 'TYPED'
                      ? `Signed: "${d.signature.data}"`
                      : 'Drawn signature captured'
                    : '\u2014'
                } else if (field.inputType === 'FILE') {
                  displayValue = d?.fileUrl ? 'File uploaded' : '\u2014'
                } else {
                  displayValue = d?.value || '\u2014'
                }

                return (
                  <div key={id} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs text-slate-500 flex-shrink-0 mt-0.5 w-1/3">
                      {field.label}
                    </span>
                    <span className="text-sm text-slate-900 flex-1">{displayValue}</span>
                  </div>
                )
              })}
          </div>
        </div>
      ))}

      {/* Turnstile */}
      <div className="pt-2">
        <TurnstileWidget
          ref={turnstileRef}
          onSuccess={onTurnstileSuccess}
          onExpire={() => {
            // Token expired — reset
          }}
          onError={() => {
            // CAPTCHA error
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!turnstileToken || submitting}
        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting\u2026
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            Submit Registration
          </>
        )}
      </button>
    </div>
  )
}

// ─── Progress indicator ───────────────────────────────────────────────────────

interface ProgressProps {
  steps: string[]
  currentStep: number
  primaryColor: string
}

export function ProgressIndicator({ steps, currentStep, primaryColor }: ProgressProps) {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide"
      role="navigation"
      aria-label={`Step ${currentStep + 1} of ${steps.length}`}
    >
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                i < currentStep
                  ? 'text-white'
                  : i === currentStep
                    ? 'text-white ring-4 ring-offset-1'
                    : 'bg-slate-100 text-slate-400'
              }`}
              style={
                i <= currentStep
                  ? { backgroundColor: primaryColor }
                  : undefined
              }
            >
              {i < currentStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs text-center max-w-[60px] truncate ${
                i === currentStep ? 'text-slate-900 font-medium' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-6 mt-[-14px] rounded-full transition-all duration-300 ${
                i < currentStep ? 'opacity-100' : 'bg-slate-200'
              }`}
              style={i < currentStep ? { backgroundColor: primaryColor } : undefined}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

export function SuccessScreen({ orgName, primaryColor }: { orgName: string; primaryColor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-12 space-y-4"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
        style={{ backgroundColor: `${primaryColor}20` }}
      >
        <Check className="w-8 h-8" style={{ color: primaryColor }} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Registration Complete!</h2>
      <p className="text-slate-600 max-w-sm mx-auto">
        Your registration has been submitted to {orgName}. You will receive a
        confirmation email shortly.
      </p>
    </motion.div>
  )
}
