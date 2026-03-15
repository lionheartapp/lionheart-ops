/**
 * Registration Payment Service
 *
 * Stripe PaymentIntent creation for FULL, DEPOSIT, and BALANCE payment types.
 * Discount code validation, payment status updates from webhook.
 *
 * CRITICAL: All payment amounts are in cents (integer).
 * Never store raw card data — Stripe Elements handles card capture.
 */

import Stripe from 'stripe'
import { rawPrisma } from '@/lib/db'

// ─── Stripe Client ─────────────────────────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PaymentType = 'FULL' | 'DEPOSIT' | 'BALANCE'

export type CreatePaymentIntentInput = {
  registrationId: string
  amount: number           // cents
  paymentType: PaymentType
  discountCode?: string
  eventProjectId: string
  organizationId: string
}

export type PaymentIntentResult = {
  clientSecret: string
  paymentIntentId: string
  amount: number          // cents after discount
  discountAmount: number  // cents discounted (0 if no discount)
  currency: string
}

export type DiscountResult = {
  discountedAmount: number  // cents
  discountAmount: number    // cents removed
}

// ─── Amount Calculation ────────────────────────────────────────────────────────

/**
 * Calculates the payment amount in cents for FULL or DEPOSIT payment types.
 */
export function calculateAmount(
  form: { basePrice: number | null; depositPercent: number | null },
  paymentType: 'FULL' | 'DEPOSIT',
): number {
  const basePrice = form.basePrice ?? 0

  if (paymentType === 'DEPOSIT') {
    const pct = form.depositPercent ?? 0
    return Math.round((basePrice * pct) / 100)
  }

  return basePrice
}

// ─── Discount Code Validation ──────────────────────────────────────────────────

/**
 * Validates a discount code and returns the discounted amount.
 * Throws if the code is invalid or has exceeded its maxUses.
 */
export async function applyDiscountCode(
  baseAmount: number,
  discountCode: string,
  formId: string,
): Promise<DiscountResult> {
  const form = await rawPrisma.registrationForm.findUnique({
    where: { id: formId },
    select: { discountCodes: true },
  })

  if (!form?.discountCodes) {
    throw new Error('Discount code not found')
  }

  const codes = form.discountCodes as Array<{
    code: string
    percentOff?: number
    amountOff?: number
    maxUses?: number
    usedCount?: number
  }>

  const entry = codes.find(
    (c) => c.code.toLowerCase() === discountCode.toLowerCase(),
  )

  if (!entry) {
    throw new Error('Discount code not found')
  }

  if (entry.maxUses != null && (entry.usedCount ?? 0) >= entry.maxUses) {
    throw new Error('Discount code has reached its usage limit')
  }

  let discountAmount = 0

  if (entry.percentOff != null && entry.percentOff > 0) {
    discountAmount = Math.round((baseAmount * entry.percentOff) / 100)
  } else if (entry.amountOff != null && entry.amountOff > 0) {
    discountAmount = Math.min(entry.amountOff, baseAmount)
  }

  const discountedAmount = Math.max(0, baseAmount - discountAmount)

  return { discountedAmount, discountAmount }
}

// ─── Create Payment Intent (FULL or DEPOSIT) ──────────────────────────────────

/**
 * Creates a Stripe PaymentIntent for FULL or DEPOSIT payments.
 * Optionally applies a discount code before creating the intent.
 *
 * Creates a RegistrationPayment row with status 'requires_action'.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntentResult> {
  const stripe = getStripeClient()

  let finalAmount = input.amount
  let discountAmount = 0

  // Apply discount code if provided
  if (input.discountCode) {
    // Find the formId for this registration
    const reg = await rawPrisma.eventRegistration.findUnique({
      where: { id: input.registrationId },
      select: { formId: true },
    })
    if (!reg) throw new Error('Registration not found')

    const discountResult = await applyDiscountCode(
      input.amount,
      input.discountCode,
      reg.formId,
    )
    finalAmount = discountResult.discountedAmount
    discountAmount = discountResult.discountAmount
  }

  // Stripe minimum is 50 cents — if amount is 0 after discount, skip PaymentIntent
  if (finalAmount < 50) {
    throw new Error(
      `Payment amount ${finalAmount} cents is below Stripe minimum. Apply a 100% discount instead.`,
    )
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: finalAmount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      registrationId: input.registrationId,
      eventProjectId: input.eventProjectId,
      organizationId: input.organizationId,
      paymentType: input.paymentType,
      ...(input.discountCode ? { discountCode: input.discountCode } : {}),
    },
  })

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client_secret')
  }

  // Record payment in DB
  await rawPrisma.registrationPayment.create({
    data: {
      registrationId: input.registrationId,
      stripePaymentIntentId: paymentIntent.id,
      amount: finalAmount,
      currency: 'usd',
      status: 'requires_action',
      paymentType: input.paymentType,
      discountCode: input.discountCode ?? null,
      discountAmount: discountAmount > 0 ? discountAmount : null,
    },
  })

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: finalAmount,
    discountAmount,
    currency: 'usd',
  }
}

// ─── Create Balance Intent ─────────────────────────────────────────────────────

/**
 * Creates a PaymentIntent for the remaining balance after a deposit was paid.
 * Fetches the registration + form to compute basePrice - totalPaid.
 */
export async function createBalanceIntent(
  registrationId: string,
): Promise<PaymentIntentResult> {
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      form: {
        select: { id: true, basePrice: true, depositPercent: true },
      },
      payments: {
        select: { amount: true, status: true, paymentType: true },
      },
    },
  })

  if (!registration) throw new Error('Registration not found')

  const basePrice = registration.form?.basePrice ?? 0

  // Sum successfully paid amounts
  const totalPaid = registration.payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)

  const balanceAmount = basePrice - totalPaid

  if (balanceAmount <= 0) {
    throw new Error('No balance remaining')
  }

  return createPaymentIntent({
    registrationId,
    amount: balanceAmount,
    paymentType: 'BALANCE',
    eventProjectId: registration.eventProjectId,
    organizationId: registration.organizationId,
  })
}

// ─── Webhook Handler ───────────────────────────────────────────────────────────

/**
 * Called from Stripe webhook handler when a PaymentIntent succeeds.
 * Updates RegistrationPayment status and EventRegistration.paymentStatus.
 *
 * paymentStatus logic:
 * - FULL or BALANCE payment → PAID
 * - DEPOSIT payment → DEPOSIT_PAID
 */
export async function handlePaymentSuccess(
  stripePaymentIntentId: string,
): Promise<void> {
  const payment = await rawPrisma.registrationPayment.findUnique({
    where: { stripePaymentIntentId },
    select: { id: true, registrationId: true, paymentType: true },
  })

  if (!payment) {
    console.warn(`[registrationPaymentService] Payment not found for PI: ${stripePaymentIntentId}`)
    return
  }

  const paymentStatus = payment.paymentType === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'PAID'

  await rawPrisma.registrationPayment.update({
    where: { id: payment.id },
    data: {
      status: 'succeeded',
      paidAt: new Date(),
    },
  })

  await rawPrisma.eventRegistration.update({
    where: { id: payment.registrationId },
    data: { paymentStatus: paymentStatus as 'PAID' | 'DEPOSIT_PAID' },
  })
}
