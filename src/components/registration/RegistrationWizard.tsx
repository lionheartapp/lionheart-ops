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
  Check,
  Loader2,
  AlertCircle,
  Shield,
  Upload,
  Image as ImageIcon,
  Lock,
} from 'lucide-react'
import PaymentStep from './PaymentStep'
import SignatureField, { type SignatureValue } from './SignatureField'
import TurnstileWidget, { type TurnstileWidgetRef } from './TurnstileWidget'
import type {
  FormConfig,
  FormSection,
  FormField,
  DiscountCode,
} from '@/lib/hooks/useRegistrationForm'

// ─── Medical fields that need FERPA lock icon ─────────────────────────────────

const MEDICAL_FIELD_KEYS = new Set([
  'allergies',
  'medications',
  'medical_notes',
  'emergency_name',
  'emergency_phone',
  'emergency_relationship',
])

// ─── Animations ───────────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
  }),
}

// ─── State management ─────────────────────────────────────────────────────────

type FieldData = {
  value: string
  values: string[]
  fileUrl: string
  signature: SignatureValue | null
}

type FormData = Record<string, FieldData>

type WizardState = {
  step: number           // current wizard step index (0-based)
  direction: number      // 1 = forward, -1 = backward (for animation)
  formData: FormData     // fieldId → response data
  coppaConsented: boolean
  coppaConsentAt: string | null
  turnstileToken: string | null
  registrationId: string | null
  submitted: boolean
  error: string | null
}

type WizardAction =
  | { type: 'NEXT'; totalSteps: number }
  | { type: 'BACK' }
  | { type: 'SET_FIELD'; fieldId: string; data: Partial<FieldData> }
  | { type: 'SET_COPPA'; consentAt: string }
  | { type: 'SET_TURNSTILE'; token: string }
  | { type: 'SET_REGISTRATION_ID'; id: string }
  | { type: 'SET_SUBMITTED' }
  | { type: 'SET_ERROR'; error: string | null }

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT':
      return {
        ...state,
        step: Math.min(state.step + 1, action.totalSteps - 1),
        direction: 1,
        error: null,
      }
    case 'BACK':
      return {
        ...state,
        step: Math.max(state.step - 1, 0),
        direction: -1,
        error: null,
      }
    case 'SET_FIELD': {
      const existing = state.formData[action.fieldId] ?? {
        value: '',
        values: [],
        fileUrl: '',
        signature: null,
      }
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.fieldId]: { ...existing, ...action.data },
        },
      }
    }
    case 'SET_COPPA':
      return {
        ...state,
        coppaConsented: true,
        coppaConsentAt: action.consentAt,
      }
    case 'SET_TURNSTILE':
      return { ...state, turnstileToken: action.token }
    case 'SET_REGISTRATION_ID':
      return { ...state, registrationId: action.id }
    case 'SET_SUBMITTED':
      return { ...state, submitted: true, error: null }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    default:
      return state
  }
}

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

// ─── Field renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField
  data: FieldData
  onUpdate: (data: Partial<FieldData>) => void
  shareSlug: string
}

function FieldRenderer({ field, data, onUpdate, shareSlug }: FieldRendererProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadPreview, setUploadPreview] = useState<string | null>(data.fileUrl || null)

  const isMedical = field.fieldKey ? MEDICAL_FIELD_KEYS.has(field.fieldKey) : false

  const labelRow = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="block text-sm font-medium text-gray-900">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {isMedical && (
        <span
          className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5"
          title="FERPA-protected information"
        >
          <Lock className="w-2.5 h-2.5" />
          FERPA
        </span>
      )}
    </div>
  )

  if (field.helpText) {
    /* help text shown below label */
  }

  const baseInputClass =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all bg-white'

  switch (field.inputType) {
    case 'TEXT':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-gray-500 mb-1.5">{field.helpText}</p>
          )}
          <input
            type="text"
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={field.placeholder ?? undefined}
            required={field.required}
            className={baseInputClass}
          />
        </div>
      )

    case 'NUMBER':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-gray-500 mb-1.5">{field.helpText}</p>
          )}
          <input
            type="number"
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={field.placeholder ?? undefined}
            required={field.required}
            className={baseInputClass}
          />
        </div>
      )

    case 'DATE':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-gray-500 mb-1.5">{field.helpText}</p>
          )}
          <input
            type="date"
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            required={field.required}
            className={baseInputClass}
          />
        </div>
      )

    case 'DROPDOWN':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-gray-500 mb-1.5">{field.helpText}</p>
          )}
          <select
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            required={field.required}
            className={`${baseInputClass} cursor-pointer`}
          >
            <option value="">Select an option</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )

    case 'CHECKBOX':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-gray-500 mb-1.5">{field.helpText}</p>
          )}
          <div className="space-y-2">
            {(field.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={data.values.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...data.values, opt.value]
                      : data.values.filter((v) => v !== opt.value)
                    onUpdate({ values: next })
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )

    case 'FILE': {
      const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadError('')
        setUploading(true)

        try {
          // Step 1: Get a signed upload URL
          const res = await fetch(`/api/events/register/${shareSlug}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              // registrationId not available at this step — server handles without it
            }),
          })

          const json = await res.json() as {
            ok: boolean
            data?: { signedUrl: string; publicUrl: string }
            error?: { message: string }
          }

          if (!json.ok || !json.data) {
            throw new Error(json.error?.message ?? 'Failed to get upload URL')
          }

          const { signedUrl, publicUrl } = json.data

          // Step 2: Upload directly to Supabase storage
          const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          })

          if (!uploadRes.ok) {
            throw new Error('Upload failed. Please try again.')
          }

          // Step 3: Store the public URL
          onUpdate({ fileUrl: publicUrl })

          // Preview for image files
          if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (ev) => {
              setUploadPreview(ev.target?.result as string)
            }
            reader.readAsDataURL(file)
          } else {
            setUploadPreview(null)
          }
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
          setUploading(false)
        }
      }

      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-gray-500 mb-1.5">{field.helpText}</p>
          )}

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
            {uploadPreview ? (
              <div className="space-y-3">
                <div className="relative w-full h-40 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadPreview}
                    alt="Upload preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadPreview(null)
                    onUpdate({ fileUrl: '' })
                  }}
                  className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
                >
                  Remove and upload different file
                </button>
              </div>
            ) : data.fileUrl ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Check className="w-4 h-4" />
                File uploaded successfully
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <span className="text-sm text-gray-600 text-center">
                  {uploading ? 'Uploading…' : 'Click to upload a file'}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={uploading}
                  accept="image/*,.pdf,.doc,.docx"
                />
              </label>
            )}
          </div>

          {uploadError && (
            <p className="flex items-center gap-1 text-xs text-red-600 mt-1.5">
              <AlertCircle className="w-3 h-3" />
              {uploadError}
            </p>
          )}
        </div>
      )
    }

    case 'SIGNATURE':
      return (
        <SignatureField
          documentLabel={field.label}
          value={data.signature ?? undefined}
          onChange={(sig) => onUpdate({ signature: sig })}
        />
      )

    default:
      return null
  }
}

// ─── COPPA step ───────────────────────────────────────────────────────────────

interface CoppaStepProps {
  orgName: string
  onConsent: () => void
}

function CoppaStep({ orgName, onConsent }: CoppaStepProps) {
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
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>
        <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-relaxed">
          I confirm that I am the parent or legal guardian of the participant
          and consent to the collection and use of their personal information
          as described in this registration form.
        </span>
      </label>

      <button
        type="button"
        onClick={onConsent}
        disabled={!checked}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer active:scale-[0.97]"
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

function ReviewStep({
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
        <h2 className="text-lg font-semibold text-gray-900">Review your information</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please review your responses before submitting.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {section.title}
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-100">
            {section.fields
              .filter((f) => f.enabled)
              .map((field) => {
                const id = field.id ?? ''
                const d = formData[id]
                let displayValue: string | null = null

                if (field.inputType === 'CHECKBOX') {
                  displayValue = d?.values?.join(', ') || '—'
                } else if (field.inputType === 'SIGNATURE') {
                  displayValue = d?.signature
                    ? d.signature.type === 'TYPED'
                      ? `Signed: "${d.signature.data}"`
                      : 'Drawn signature captured'
                    : '—'
                } else if (field.inputType === 'FILE') {
                  displayValue = d?.fileUrl ? 'File uploaded' : '—'
                } else {
                  displayValue = d?.value || '—'
                }

                return (
                  <div key={id} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5 w-1/3">
                      {field.label}
                    </span>
                    <span className="text-sm text-gray-900 flex-1">{displayValue}</span>
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
            Submitting…
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

function ProgressIndicator({ steps, currentStep, primaryColor }: ProgressProps) {
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
                    : 'bg-gray-100 text-gray-400'
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
                i === currentStep ? 'text-gray-900 font-medium' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-6 mt-[-14px] rounded-full transition-all duration-300 ${
                i < currentStep ? 'opacity-100' : 'bg-gray-200'
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

function SuccessScreen({ orgName, primaryColor }: { orgName: string; primaryColor: string }) {
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
      <h2 className="text-2xl font-bold text-gray-900">Registration Complete!</h2>
      <p className="text-gray-600 max-w-sm mx-auto">
        Your registration has been submitted to {orgName}. You will receive a
        confirmation email shortly.
      </p>
    </motion.div>
  )
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
    async (formData: FormData) => {
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
                  <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                  {section.description && (
                    <p className="text-sm text-gray-500 mt-1">{section.description}</p>
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
              <h2 className="text-xl font-semibold text-gray-900">Payment</h2>
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
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
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
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Edit responses
        </button>
      )}
    </div>
  )
}

// ─── Step builder ─────────────────────────────────────────────────────────────

type WizardStep =
  | { type: 'coppa'; label: string }
  | { type: 'section'; sectionId: string; label: string }
  | { type: 'payment'; label: string }
  | { type: 'review'; label: string }

function buildSteps(form: FormConfig, sections: FormSection[]): WizardStep[] {
  const steps: WizardStep[] = []

  if (form.requiresCoppaConsent) {
    steps.push({ type: 'coppa', label: 'Consent' })
  }

  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const section of sorted) {
    steps.push({
      type: 'section',
      sectionId: section.id ?? '',
      label: section.title,
    })
  }

  if (form.requiresPayment) {
    steps.push({ type: 'payment', label: 'Payment' })
  }

  steps.push({ type: 'review', label: 'Review' })

  return steps
}

// ─── Submission payload builder ───────────────────────────────────────────────

type SubmissionPayload = {
  turnstileToken: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  grade?: string
  photoUrl?: string
  tshirtSize?: string
  dietaryNeeds?: string
  coppaConsentAt?: string
  responses: Array<{
    fieldId: string
    value?: string
    values?: string[]
    fileUrl?: string
  }>
  sensitiveData?: {
    allergies?: string
    medications?: string
    medicalNotes?: string
    emergencyName?: string
    emergencyPhone?: string
    emergencyRelationship?: string
  }
}

function buildSubmissionPayload(
  state: WizardState,
  form: FormConfig,
  sections: FormSection[],
  formData: FormData,
  isDraft: boolean,
): SubmissionPayload {
  void form
  void isDraft

  // Extract well-known common fields from formData
  const allFields = sections.flatMap((s) => s.fields)

  function findFieldValue(fieldKey: string): string | undefined {
    const field = allFields.find((f) => f.fieldKey === fieldKey)
    if (!field?.id) return undefined
    return formData[field.id]?.value || undefined
  }

  const firstName = findFieldValue('first_name') ?? ''
  const lastName = findFieldValue('last_name') ?? ''
  const email = findFieldValue('email') ?? ''

  // Build responses array for all fields
  const responses = allFields
    .filter((f) => f.id)
    .map((f) => {
      const id = f.id ?? ''
      const d = formData[id]
      if (!d) return null

      return {
        fieldId: id,
        value: f.inputType === 'SIGNATURE'
          ? d.signature?.type === 'TYPED' ? d.signature.data : undefined
          : d.value || undefined,
        values: d.values.length > 0 ? d.values : undefined,
        fileUrl: d.fileUrl || undefined,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // Build sensitive data from medical fields
  const sensitiveData: SubmissionPayload['sensitiveData'] = {
    allergies: findFieldValue('allergies'),
    medications: findFieldValue('medications'),
    medicalNotes: findFieldValue('medical_notes'),
    emergencyName: findFieldValue('emergency_name'),
    emergencyPhone: findFieldValue('emergency_phone'),
    emergencyRelationship: findFieldValue('emergency_relationship'),
  }

  // Strip undefined values
  const cleanSensitive = Object.fromEntries(
    Object.entries(sensitiveData).filter(([, v]) => v !== undefined),
  ) as SubmissionPayload['sensitiveData']

  return {
    turnstileToken: state.turnstileToken ?? 'dev-token',
    firstName,
    lastName,
    email,
    phone: findFieldValue('phone'),
    grade: findFieldValue('grade'),
    photoUrl: allFields.find((f) => f.fieldKey === 'photo')
      ? formData[allFields.find((f) => f.fieldKey === 'photo')?.id ?? '']?.fileUrl || undefined
      : undefined,
    tshirtSize: findFieldValue('tshirt_size'),
    dietaryNeeds: findFieldValue('dietary_needs'),
    coppaConsentAt: state.coppaConsentAt ?? undefined,
    responses,
    sensitiveData: Object.keys(cleanSensitive ?? {}).length > 0 ? cleanSensitive : undefined,
  }
}
