'use client'

/**
 * PaymentStep — Stripe Payment Element with Express Checkout.
 *
 * Flow:
 * 1. Show payment summary with FULL/DEPOSIT selection and discount code input
 * 2. POST to /api/events/register/{shareSlug}/payment-intent to get clientSecret
 * 3. Mount Stripe <Elements> with clientSecret + white-label appearance
 * 4. Render <ExpressCheckoutElement> (Apple/Google Pay — auto-shows if available)
 * 5. Render <PaymentElement> for card input
 * 6. "Pay $X" confirms payment via stripe.confirmPayment()
 */

import { useState, useCallback, useMemo } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Loader2, Tag, AlertCircle, CreditCard } from 'lucide-react'
import type { DiscountCode } from '@/lib/hooks/useRegistrationForm'

// ─── Stripe instance (singleton) ─────────────────────────────────────────────

const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentStepProps {
  registrationId: string
  shareSlug: string
  amount: number            // base amount in cents
  depositPercent?: number | null
  discountCodes?: DiscountCode[] | null
  orgPrimaryColor?: string
  onPaymentSuccess?: (paymentIntentId: string) => void
  onPaymentError?: (message: string) => void
  returnUrl: string
}

type PaymentType = 'FULL' | 'DEPOSIT'

// ─── Inner checkout form (inside <Elements>) ──────────────────────────────────

interface CheckoutFormProps {
  amount: number
  paymentType: PaymentType
  onSuccess?: (paymentIntentId: string) => void
  onError?: (message: string) => void
  returnUrl: string
}

function CheckoutForm({
  amount,
  onError,
  returnUrl,
}: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!stripe || !elements) return

      setProcessing(true)
      try {
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: returnUrl,
          },
        })

        // confirmPayment redirects on success; error means it stayed here
        if (error) {
          onError?.(error.message ?? 'Payment failed. Please try again.')
        }
      } catch {
        onError?.('An unexpected error occurred. Please try again.')
      } finally {
        setProcessing(false)
      }
    },
    [stripe, elements, returnUrl, onError],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Express checkout (Apple Pay / Google Pay) */}
      <div>
        <ExpressCheckoutElement
          onConfirm={() => {
            // Handled by Stripe's redirect flow
          }}
          options={{
            layout: { maxRows: 1, maxColumns: 2 },
          }}
        />
      </div>

      {/* Divider */}
      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or pay by card</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Card payment element */}
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer active:scale-[0.97]"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Pay {formatCents(amount)}
          </>
        )}
      </button>
    </form>
  )
}

// ─── PaymentStep (outer shell) ────────────────────────────────────────────────

export default function PaymentStep({
  registrationId,
  shareSlug,
  amount,
  depositPercent,
  discountCodes,
  orgPrimaryColor,
  onPaymentSuccess,
  onPaymentError,
  returnUrl,
}: PaymentStepProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>(
    depositPercent ? 'DEPOSIT' : 'FULL',
  )
  const [discountCode, setDiscountCode] = useState('')
  const [discountError, setDiscountError] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [intentError, setIntentError] = useState('')

  // Compute effective amount
  const effectiveAmount = useMemo(() => {
    let base = amount

    // Apply deposit percentage
    if (paymentType === 'DEPOSIT' && depositPercent) {
      base = Math.round(base * (depositPercent / 100))
    }

    // Apply discount
    if (appliedDiscount) {
      if (appliedDiscount.amountOff) {
        base = Math.max(0, base - appliedDiscount.amountOff)
      } else if (appliedDiscount.percentOff) {
        base = Math.round(base * (1 - appliedDiscount.percentOff / 100))
      }
    }

    return base
  }, [amount, paymentType, depositPercent, appliedDiscount])

  // Apply discount code
  const handleApplyDiscount = useCallback(() => {
    setDiscountError('')
    const code = discountCode.trim().toUpperCase()
    if (!code) return

    const found = discountCodes?.find(
      (d) => d.code.toUpperCase() === code &&
        (d.maxUses === null || d.usedCount < d.maxUses),
    )

    if (!found) {
      setDiscountError('Invalid or expired discount code.')
      return
    }

    setAppliedDiscount(found)
    setDiscountCode('')
  }, [discountCode, discountCodes])

  // Create payment intent
  const handleProceedToPayment = useCallback(async () => {
    setLoadingIntent(true)
    setIntentError('')

    try {
      const res = await fetch(`/api/events/register/${shareSlug}/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId,
          paymentType,
          discountCode: appliedDiscount?.code ?? undefined,
        }),
      })
      const json = await res.json() as {
        ok: boolean
        data?: { clientSecret: string }
        error?: { message: string }
      }

      if (!json.ok) {
        setIntentError(json.error?.message ?? 'Failed to initialize payment.')
        return
      }

      setClientSecret(json.data?.clientSecret ?? null)
    } catch {
      setIntentError('Failed to connect to payment server. Please try again.')
    } finally {
      setLoadingIntent(false)
    }
  }, [shareSlug, registrationId, paymentType, appliedDiscount])

  // Stripe appearance (white-labeled)
  const appearance = useMemo(
    () => ({
      theme: 'stripe' as const,
      variables: {
        colorPrimary: orgPrimaryColor ?? '#6366f1',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '12px',
      },
    }),
    [orgPrimaryColor],
  )

  // Phase 1: payment type + discount selection
  if (!clientSecret) {
    return (
      <div className="space-y-5">
        {/* Amount summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Payment Summary</h3>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Registration fee</span>
            <span className="font-medium text-gray-900">{formatCents(amount)}</span>
          </div>

          {appliedDiscount && (
            <div className="flex items-center justify-between text-sm text-green-700">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Discount ({appliedDiscount.code})
              </span>
              <span className="font-medium">
                {appliedDiscount.amountOff
                  ? `−${formatCents(appliedDiscount.amountOff)}`
                  : appliedDiscount.percentOff
                    ? `−${appliedDiscount.percentOff}%`
                    : ''}
              </span>
            </div>
          )}

          {depositPercent && paymentType === 'DEPOSIT' && (
            <div className="flex items-center justify-between text-sm text-blue-700">
              <span>Deposit ({depositPercent}%)</span>
              <span className="font-medium">
                {formatCents(Math.round(amount * (depositPercent / 100)))}
              </span>
            </div>
          )}

          <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-semibold text-gray-900">
            <span>Total due today</span>
            <span>{formatCents(effectiveAmount)}</span>
          </div>
        </div>

        {/* Payment type selector (only if deposit option exists) */}
        {depositPercent != null && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Payment option</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('FULL')}
                className={`p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                  paymentType === 'FULL'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Pay in full
                <span className="block text-xs font-normal mt-0.5">
                  {formatCents(amount)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('DEPOSIT')}
                className={`p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                  paymentType === 'DEPOSIT'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Pay deposit
                <span className="block text-xs font-normal mt-0.5">
                  {formatCents(Math.round(amount * (depositPercent / 100)))} now
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Discount code */}
        {discountCodes && discountCodes.length > 0 && !appliedDiscount && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              Discount code (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value.toUpperCase())
                  setDiscountError('')
                }}
                placeholder="ENTER CODE"
                className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 uppercase"
              />
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
            {discountError && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                {discountError}
              </p>
            )}
          </div>
        )}

        {intentError && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {intentError}
          </div>
        )}

        <button
          type="button"
          onClick={handleProceedToPayment}
          disabled={loadingIntent || effectiveAmount === 0}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer active:scale-[0.97]"
        >
          {loadingIntent ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Setting up payment…
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              Continue to payment
            </>
          )}
        </button>
      </div>
    )
  }

  // Phase 2: Stripe Elements payment form
  if (!stripePromise) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Payment is not configured. Please contact the organizer.
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance }}
    >
      <div className="space-y-4">
        {/* Amount reminder */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
          <span className="text-gray-600">Amount due</span>
          <span className="font-semibold text-gray-900">{formatCents(effectiveAmount)}</span>
        </div>

        <CheckoutForm
          amount={effectiveAmount}
          paymentType={paymentType}
          onSuccess={onPaymentSuccess}
          onError={onPaymentError}
          returnUrl={returnUrl}
        />
      </div>
    </Elements>
  )
}
