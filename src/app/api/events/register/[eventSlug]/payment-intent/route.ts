/**
 * Public payment intent API — no authentication required.
 *
 * POST /api/events/register/[eventSlug]/payment-intent
 *
 * Creates a Stripe PaymentIntent for FULL or DEPOSIT payments.
 * Returns a clientSecret for Stripe Elements on the frontend.
 *
 * SECURITY:
 * - Turnstile token verified first
 * - Rate limited: 5 per IP per hour
 * - Amount is always computed server-side from the form config
 * - organizationId resolved from the form (never from URL params)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { verifyTurnstile } from '@/lib/turnstile'
import { RateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { rawPrisma } from '@/lib/db'
import {
  createPaymentIntent,
  calculateAmount,
} from '@/lib/services/registrationPaymentService'

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const paymentIntentRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 5,            // 5 per IP per hour
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  turnstileToken: z.string().min(1, 'Turnstile token is required'),
  registrationId: z.string().min(1, 'Registration ID is required'),
  paymentType: z.enum(['FULL', 'DEPOSIT']),
  discountCode: z.string().optional(),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const { eventSlug } = await params
    const ip = getClientIp(req)

    // 1. Parse and validate body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(fail('INVALID_JSON', 'Request body must be valid JSON'), { status: 400 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request data', parsed.error.issues),
        { status: 400 },
      )
    }

    const data = parsed.data

    // 2. Verify Turnstile CAPTCHA
    const turnstileValid = await verifyTurnstile(data.turnstileToken, ip)
    if (!turnstileValid) {
      return NextResponse.json(
        fail('CAPTCHA_FAILED', 'CAPTCHA verification failed. Please try again.'),
        { status: 422 },
      )
    }

    // 3. Rate limit by IP
    paymentIntentRateLimiter.increment(ip)
    const rateLimitResult = paymentIntentRateLimiter.check(ip)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many payment attempts from this IP. Please try again later.'),
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      )
    }

    // 4. Verify registration and form belong to this event slug
    // CRITICAL: Resolve organizationId from the slug — never from URL params
    const form = await rawPrisma.registrationForm.findUnique({
      where: { shareSlug: eventSlug },
      select: {
        id: true,
        organizationId: true,
        eventProjectId: true,
        requiresPayment: true,
        basePrice: true,
        depositPercent: true,
      },
    })

    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Registration form not found'), { status: 404 })
    }

    if (!form.requiresPayment) {
      return NextResponse.json(
        fail('PAYMENT_NOT_REQUIRED', 'This event does not require payment'),
        { status: 422 },
      )
    }

    // Verify the registration belongs to this form
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id: data.registrationId },
      select: { id: true, formId: true, organizationId: true, eventProjectId: true },
    })

    if (!registration || registration.formId !== form.id) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Registration not found for this event'),
        { status: 404 },
      )
    }

    // 5. Calculate the amount server-side (never trust client amounts)
    const amount = calculateAmount(form, data.paymentType)

    if (amount <= 0) {
      return NextResponse.json(
        fail('INVALID_AMOUNT', 'Payment amount must be greater than zero'),
        { status: 422 },
      )
    }

    // 6. Create PaymentIntent
    const result = await createPaymentIntent({
      registrationId: data.registrationId,
      amount,
      paymentType: data.paymentType,
      discountCode: data.discountCode,
      eventProjectId: form.eventProjectId,
      organizationId: form.organizationId,
    })

    return NextResponse.json(ok({
      clientSecret: result.clientSecret,
      amount: result.amount,
      discountAmount: result.discountAmount,
      currency: result.currency,
    }))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Discount code')) {
        return NextResponse.json(fail('INVALID_DISCOUNT', error.message), { status: 422 })
      }
      if (error.message.includes('Stripe')) {
        return NextResponse.json(fail('PAYMENT_ERROR', 'Payment service error. Please try again.'), { status: 502 })
      }
      if (error.message.includes('STRIPE_SECRET_KEY')) {
        console.error('[payment-intent] Stripe not configured')
        return NextResponse.json(fail('PAYMENT_NOT_CONFIGURED', 'Payments are not configured'), { status: 503 })
      }
    }
    console.error('[payment-intent POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
