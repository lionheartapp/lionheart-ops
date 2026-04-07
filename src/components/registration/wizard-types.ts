/**
 * Types and constants for the RegistrationWizard.
 */

import type { SignatureValue } from './SignatureField'
import type { FormConfig, FormSection } from '@/lib/hooks/useRegistrationForm'

// ─── Medical fields that need FERPA lock icon ─────────────────────────────────

export const MEDICAL_FIELD_KEYS = new Set([
  'allergies',
  'medications',
  'medical_notes',
  'emergency_name',
  'emergency_phone',
  'emergency_relationship',
])

// ─── Animations ───────────────────────────────────────────────────────────────

export const slideVariants = {
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

export type FieldData = {
  value: string
  values: string[]
  fileUrl: string
  signature: SignatureValue | null
}

export type FormData = Record<string, FieldData>

export type WizardState = {
  step: number           // current wizard step index (0-based)
  direction: number      // 1 = forward, -1 = backward (for animation)
  formData: FormData     // fieldId -> response data
  coppaConsented: boolean
  coppaConsentAt: string | null
  turnstileToken: string | null
  registrationId: string | null
  submitted: boolean
  error: string | null
}

export type WizardAction =
  | { type: 'NEXT'; totalSteps: number }
  | { type: 'BACK' }
  | { type: 'SET_FIELD'; fieldId: string; data: Partial<FieldData> }
  | { type: 'SET_COPPA'; consentAt: string }
  | { type: 'SET_TURNSTILE'; token: string }
  | { type: 'SET_REGISTRATION_ID'; id: string }
  | { type: 'SET_SUBMITTED' }
  | { type: 'SET_ERROR'; error: string | null }

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
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

// ─── Step builder ─────────────────────────────────────────────────────────────

export type WizardStep =
  | { type: 'coppa'; label: string }
  | { type: 'section'; sectionId: string; label: string }
  | { type: 'payment'; label: string }
  | { type: 'review'; label: string }

export function buildSteps(form: FormConfig, sections: FormSection[]): WizardStep[] {
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

export type SubmissionPayload = {
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

export function buildSubmissionPayload(
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
