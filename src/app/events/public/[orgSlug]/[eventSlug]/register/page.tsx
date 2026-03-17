'use client'

/**
 * Registration page — embeds RegistrationWizard with form data and branding.
 *
 * Fetches form data from GET /api/events/register/{eventSlug}.
 * Redirects to event landing page if form not found or registration is closed.
 * Handles Stripe return_url redirect (payment_intent query param on mount).
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import RegistrationWizard, { type RegistrationWizardProps } from '@/components/registration/RegistrationWizard'

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; props: RegistrationWizardProps }
  | { phase: 'payment_confirmation' }
  | { phase: 'error'; message: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPrimaryColor(theme: unknown): string {
  if (!theme || typeof theme !== 'string') return '#6366f1'
  try {
    const parsed = JSON.parse(theme) as Record<string, unknown>
    if (typeof parsed.primaryColor === 'string') return parsed.primaryColor
  } catch {
    // Not JSON
  }
  return '#6366f1'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const params = useParams<{ orgSlug: string; eventSlug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [state, setState] = useState<LoadState>({ phase: 'loading' })

  useEffect(() => {
    const { orgSlug, eventSlug } = params

    // Check if this is a Stripe return redirect (payment confirmed)
    const paymentIntentId = searchParams.get('payment_intent')
    const paymentStatus = searchParams.get('redirect_status')

    if (paymentIntentId && paymentStatus === 'succeeded') {
      setState({ phase: 'payment_confirmation' })
      return
    }

    // Fetch form data
    void (async () => {
      try {
        const res = await fetch(`/api/events/register/${eventSlug}`)
        const json = await res.json() as {
          ok: boolean
          data?: Record<string, unknown>
          error?: { code: string; message: string }
        }

        if (!json.ok) {
          const code = json.error?.code ?? ''
          if (code === 'NOT_FOUND' || code === 'CLOSED' || code === 'NOT_OPEN') {
            // Redirect back to event landing page
            router.replace(`/events/public/${orgSlug}/${eventSlug}`)
            return
          }
          setState({
            phase: 'error',
            message: json.error?.message ?? 'Failed to load registration form.',
          })
          return
        }

        const data = json.data as Record<string, unknown>
        const form = data.form as Record<string, unknown> | null
        const sections = data.sections as Record<string, unknown>[]
        const organization = data.organization as Record<string, unknown> | null

        if (!form || !sections) {
          router.replace(`/events/public/${orgSlug}/${eventSlug}`)
          return
        }

        const primaryColor = extractPrimaryColor(organization?.theme)

        const wizardProps: RegistrationWizardProps = {
          shareSlug: eventSlug,
          form: {
            id: String(form.id ?? ''),
            title: form.title as string | null,
            requiresPayment: Boolean(form.requiresPayment),
            basePrice: form.basePrice as number | null,
            depositPercent: form.depositPercent as number | null,
            maxCapacity: form.maxCapacity as number | null,
            waitlistEnabled: Boolean(form.waitlistEnabled),
            requiresCoppaConsent: Boolean(form.requiresCoppaConsent),
            openAt: form.openAt as string | null,
            closeAt: form.closeAt as string | null,
            shareSlug: String(form.shareSlug ?? ''),
            discountCodes: null, // Not returned from public API
          },
          sections: (sections as Array<{
            id?: string
            title: string
            description: string | null
            sortOrder: number
            fields: Array<{
              id?: string
              fieldType: 'COMMON' | 'CUSTOM'
              fieldKey: string | null
              inputType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX' | 'NUMBER' | 'DATE' | 'FILE' | 'SIGNATURE'
              label: string
              helpText: string | null
              placeholder: string | null
              required: boolean
              enabled: boolean
              options: Array<{ label: string; value: string }> | null
              sortOrder: number
            }>
          }>).map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            sortOrder: s.sortOrder,
            fields: (s.fields ?? []).map((f) => ({
              id: f.id,
              fieldType: f.fieldType,
              fieldKey: f.fieldKey,
              inputType: f.inputType,
              label: f.label,
              helpText: f.helpText,
              placeholder: f.placeholder,
              required: f.required,
              enabled: f.enabled,
              options: f.options,
              sortOrder: f.sortOrder,
            })),
          })),
          orgBranding: {
            logoUrl: organization?.logoUrl as string | null,
            primaryColor,
            name: String(organization?.name ?? 'School'),
          },
        }

        setState({ phase: 'loaded', props: wizardProps })
      } catch {
        setState({
          phase: 'error',
          message: 'Failed to connect to server. Please check your connection.',
        })
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Loading
  if (state.phase === 'loading') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading registration form…</p>
        </div>
      </div>
    )
  }

  // Payment confirmation (Stripe redirect back)
  if (state.phase === 'payment_confirmation') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-[40vh] flex items-center justify-center"
      >
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
          <p className="text-gray-500">
            Your registration and payment have been confirmed. A confirmation email
            will be sent to you shortly.
          </p>
        </div>
      </motion.div>
    )
  }

  // Error
  if (state.phase === 'error') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Unable to load form</h2>
          <p className="text-sm text-gray-500">{state.message}</p>
        </div>
      </div>
    )
  }

  // Loaded — render the wizard
  return (
    <div className="max-w-2xl mx-auto">
      {state.props.form.title && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{state.props.form.title}</h1>
        </div>
      )}
      <RegistrationWizard {...state.props} />
    </div>
  )
}
