/**
 * Public registration API — no authentication required.
 *
 * GET  /api/events/register/[eventSlug]  — fetch public form info for rendering the wizard
 * POST /api/events/register/[eventSlug]  — submit a registration (Turnstile + rate-limited)
 *
 * SECURITY:
 * - organizationId is NEVER taken from URL params — always resolved from the form record
 * - Turnstile token verified before any DB write
 * - Rate limited: 10 registrations per IP per hour
 * - Medical/sensitive data never returned from GET
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { verifyTurnstile } from '@/lib/turnstile'
import { RateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import {
  getRegistrationFormBySlug,
  submitRegistration,
} from '@/lib/services/registrationService'
import { sendConfirmationEmail } from '@/lib/services/registrationEmailService'

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const registrationRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 10,           // 10 registrations per IP per hour
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

const responseSchema = z.object({
  fieldId: z.string(),
  value: z.string().optional(),
  values: z.unknown().optional(),
  fileUrl: z.string().url().optional(),
})

const sensitiveDataSchema = z.object({
  allergies: z.string().optional(),
  medications: z.string().optional(),
  medicalNotes: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelationship: z.string().optional(),
}).optional()

const submitSchema = z.object({
  turnstileToken: z.string().min(1, 'Turnstile token is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  grade: z.string().optional(),
  photoUrl: z.string().url().optional(),
  tshirtSize: z.string().optional(),
  dietaryNeeds: z.string().optional(),
  coppaConsentAt: z.string().datetime().optional(),
  coppaConsentIp: z.string().optional(),
  responses: z.array(responseSchema).default([]),
  sensitiveData: sensitiveDataSchema,
})

// ─── GET ──────────────────────────────────────────────────────────────────────

/**
 * Returns public event info + form config + sections + fields.
 * No authentication required. Does NOT include capacity counts or discount codes.
 * Returns 404 if form not found or outside open/close dates.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const { eventSlug } = await params
    const form = await getRegistrationFormBySlug(eventSlug)

    if (!form) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Registration form not found'),
        { status: 404 },
      )
    }

    // Check open/close dates
    const formRecord = form as {
      openAt?: string | Date | null
      closeAt?: string | Date | null
    }

    const now = new Date()

    if (formRecord.openAt && new Date(formRecord.openAt) > now) {
      return NextResponse.json(
        fail('NOT_OPEN', 'Registration has not opened yet'),
        { status: 404 },
      )
    }

    if (formRecord.closeAt && new Date(formRecord.closeAt) < now) {
      return NextResponse.json(
        fail('CLOSED', 'Registration has closed'),
        { status: 404 },
      )
    }

    // Strip open/close dates from public response (internal scheduling data)
    const { openAt: _openAt, closeAt: _closeAt, ...publicForm } = form as Record<string, unknown>
    void _openAt
    void _closeAt

    return NextResponse.json(ok(publicForm))
  } catch (error) {
    console.error('[register GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

/**
 * Submits a registration for an event.
 * Validates Turnstile first, then rate-limits by IP.
 */
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

    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid registration data', parsed.error.issues),
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
    registrationRateLimiter.increment(ip)
    const rateLimitResult = registrationRateLimiter.check(ip)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many registrations from this IP. Please try again later.'),
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      )
    }

    // 4. Submit registration
    const registration = await submitRegistration({
      shareSlug: eventSlug,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      grade: data.grade,
      photoUrl: data.photoUrl,
      tshirtSize: data.tshirtSize,
      dietaryNeeds: data.dietaryNeeds,
      coppaConsentAt: data.coppaConsentAt ? new Date(data.coppaConsentAt) : undefined,
      coppaConsentIp: data.coppaConsentIp,
      responses: data.responses.map((r) => ({
        fieldId: r.fieldId,
        value: r.value,
        values: r.values,
        fileUrl: r.fileUrl,
      })),
      sensitiveData: data.sensitiveData,
    })

    const requiresPayment = (registration as { requiresPayment?: boolean }).requiresPayment

    // 5. If no payment required, send confirmation email immediately
    if (!requiresPayment) {
      const regId = (registration as { id: string }).id
      sendConfirmationEmail(regId).catch((err) => {
        console.error('[register POST] sendConfirmationEmail failed:', err)
      })
    }

    // 6. Return registration (without sensitiveData) and payment flag
    const { sensitiveData: _sensitive, ...publicRegistration } = registration as Record<string, unknown>
    void _sensitive

    return NextResponse.json(
      ok({ registration: publicRegistration, requiresPayment: requiresPayment ?? false }),
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error) {
      // Known domain errors from registrationService
      if (error.message === 'Registration form not found') {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
      if (error.message === 'Registration has not opened yet') {
        return NextResponse.json(fail('NOT_OPEN', error.message), { status: 422 })
      }
      if (error.message === 'Registration has closed') {
        return NextResponse.json(fail('CLOSED', error.message), { status: 422 })
      }
      if (error.message.includes('full and waitlist')) {
        return NextResponse.json(fail('CAPACITY_FULL', error.message), { status: 422 })
      }
    }
    console.error('[register POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
