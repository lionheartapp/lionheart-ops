'use client'

import { useState, useMemo } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Loader2, Tag, CheckCircle2 } from 'lucide-react'
import TicketSelector, { type TicketTypePublic } from './TicketSelector'
import OrderSummary from './OrderSummary'

// ─── Stripe singleton ──────────────────────────────────────────────────────

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

// ─── Types ─────────────────────────────────────────────────────────────────

interface FormPageData {
  id: string
  title: string
  fields: Array<{
    id: string
    key: string
    label: string
    type: string
    required: boolean
    placeholder: string | null
    helpText: string | null
    options: string[]
  }>
}

interface TicketCheckoutFlowProps {
  formId: string
  ticketTypes: TicketTypePublic[]
  hasDiscountCodes: boolean
  pages: FormPageData[] // custom fields to collect
  requireEmail: boolean
  ctaColor: string
  onComplete: (orderId: string) => void
}

// ─── Payment Form (inside Elements) ───────────────────────────────────────

function PaymentForm({ amount, ctaColor, onSuccess, onError }: {
  amount: number
  ctaColor: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href + '?payment=success',
      },
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message ?? 'Payment failed')
      setProcessing(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ExpressCheckoutElement
        onConfirm={async () => {
          if (!stripe || !elements) return
          const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.href + '?payment=success' },
            redirect: 'if_required',
          })
          if (error) onError(error.message ?? 'Payment failed')
          else onSuccess()
        }}
      />
      <PaymentElement />
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full py-3 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        style={{ backgroundColor: ctaColor }}
      >
        {processing ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        ) : (
          `Pay $${(amount / 100).toFixed(2)}`
        )}
      </button>
    </form>
  )
}

// ─── Main Flow ─────────────────────────────────────────────────────────────

export default function TicketCheckoutFlow({
  formId,
  ticketTypes,
  hasDiscountCodes,
  pages,
  requireEmail,
  ctaColor,
  onComplete,
}: TicketCheckoutFlowProps) {
  // Step tracking
  const [step, setStep] = useState<'tickets' | 'info' | 'payment'>('tickets')

  // Ticket selection
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // Promo code
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState<string | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountLabel, setDiscountLabel] = useState<string | null>(null)

  // Buyer info
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  // Payment
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Computed
  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0)
  const subtotal = ticketTypes.reduce((sum, tt) => sum + (tt.price * (quantities[tt.id] ?? 0)), 0)
  const total = Math.max(0, subtotal - discountAmount)

  function handleQuantityChange(ticketTypeId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [ticketTypeId]: qty }))
  }

  async function handleCheckout() {
    setSubmitting(true)
    setCheckoutError(null)

    const lineItems = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))

    try {
      const res = await fetch(`/api/f/${formId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems,
          buyerName,
          buyerEmail,
          buyerPhone: buyerPhone || undefined,
          discountCode: promoApplied || undefined,
          formData: Object.keys(formValues).length > 0 ? formValues : undefined,
        }),
      })

      const json = await res.json()

      if (!json.ok) {
        setCheckoutError(json.error?.message ?? 'Checkout failed')
        setSubmitting(false)
        return
      }

      setOrderId(json.data.orderId)

      if (json.data.clientSecret) {
        setClientSecret(json.data.clientSecret)
        setStep('payment')
      } else {
        // Free order — done
        onComplete(json.data.orderId)
      }
    } catch {
      setCheckoutError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Validate promo code client-side is not possible (codes are server-side only)
  // We'll validate during checkout. For UX, show the code as "will be applied at checkout"
  function handleApplyPromo() {
    if (!promoCode.trim()) return
    setPromoApplied(promoCode.trim().toUpperCase())
    setDiscountLabel(promoCode.trim().toUpperCase())
    setPromoError(null)
    // Actual discount amount comes back from the server during checkout
    // For now, show it as pending
  }

  const inputCls = "w-full h-11 px-3.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"

  // ─── Step: Tickets ──────────────────────────────────────────────────────
  if (step === 'tickets') {
    return (
      <div className="space-y-5">
        <TicketSelector
          ticketTypes={ticketTypes}
          quantities={quantities}
          onChange={handleQuantityChange}
        />

        {/* Promo code */}
        {hasDiscountCodes && (
          <div>
            <div className="flex gap-2">
              {/* eslint-disable-next-line no-restricted-syntax -- public form */}
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Promo code"
                className="flex-1 h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={!promoCode.trim()}
                className="px-4 h-10 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            {promoApplied && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {promoApplied} will be applied at checkout
              </p>
            )}
            {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
          </div>
        )}

        <OrderSummary
          ticketTypes={ticketTypes}
          quantities={quantities}
          discountLabel={discountLabel}
          discountAmount={discountAmount}
        />

        <button
          type="button"
          onClick={() => setStep('info')}
          disabled={totalQty === 0}
          className="w-full py-3 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: totalQty > 0 ? ctaColor : '#94a3b8' }}
        >
          Continue
        </button>
      </div>
    )
  }

  // ─── Step: Buyer Info ───────────────────────────────────────────────────
  if (step === 'info') {
    const hasCustomFields = pages.some((p) => p.fields.length > 0)

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep('tickets')}
          className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          ← Back to tickets
        </button>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          {/* eslint-disable-next-line no-restricted-syntax -- public form */}
          <input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          {/* eslint-disable-next-line no-restricted-syntax -- public form */}
          <input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Phone <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          {/* eslint-disable-next-line no-restricted-syntax -- public form */}
          <input
            type="tel"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
            placeholder="(555) 123-4567"
            autoComplete="tel"
            className={inputCls}
          />
        </div>

        {/* Custom form fields */}
        {hasCustomFields && pages.map((page) =>
          page.fields.map((field) => (
            <div key={field.id}>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.helpText && <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>}
              {/* eslint-disable-next-line no-restricted-syntax -- public form */}
              <input
                type={field.type === 'EMAIL' ? 'email' : field.type === 'NUMBER' ? 'number' : 'text'}
                value={formValues[field.key] ?? ''}
                onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder ?? ''}
                className={inputCls}
              />
            </div>
          ))
        )}

        {checkoutError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {checkoutError}
          </div>
        )}

        <OrderSummary
          ticketTypes={ticketTypes}
          quantities={quantities}
          discountLabel={discountLabel}
          discountAmount={discountAmount}
        />

        <button
          type="button"
          onClick={handleCheckout}
          disabled={submitting || !buyerName.trim() || !buyerEmail.trim()}
          className="w-full py-3 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: ctaColor }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : total === 0 ? (
            'Complete Order'
          ) : (
            `Pay $${(total / 100).toFixed(2)}`
          )}
        </button>
      </div>
    )
  }

  // ─── Step: Payment (Stripe Elements) ───────────────────────────────────
  if (step === 'payment' && clientSecret) {
    const appearance = {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: ctaColor,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: '8px',
      },
    }

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep('info')}
          className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          ← Back
        </button>

        <OrderSummary
          ticketTypes={ticketTypes}
          quantities={quantities}
          discountLabel={discountLabel}
          discountAmount={discountAmount}
        />

        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <PaymentForm
            amount={total}
            ctaColor={ctaColor}
            onSuccess={() => onComplete(orderId!)}
            onError={(msg) => setCheckoutError(msg)}
          />
        </Elements>

        {checkoutError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {checkoutError}
          </div>
        )}
      </div>
    )
  }

  return null
}
