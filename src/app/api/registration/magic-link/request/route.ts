/**
 * POST /api/registration/magic-link/request
 *
 * PUBLIC route — rate-limited. Accepts an email address and sends magic link(s)
 * for any active registrations associated with that email.
 *
 * Security: Returns 200 regardless of whether the email has registrations
 * to prevent email enumeration attacks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit, issueMagicLink } from '@/lib/services/registrationMagicLinkService'

// ─── Validation ───────────────────────────────────────────────────────────────

const requestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

// ─── IP Extraction ────────────────────────────────────────────────────────────

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Parse and validate body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Request body must be valid JSON'),
        { status: 400 },
      )
    }

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input'),
        { status: 400 },
      )
    }

    const { email } = parsed.data
    const ip = getIp(req)

    // Check rate limits before doing any DB work
    const rateLimit = checkRateLimit(email, ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many requests. Please try again later.', [
          { field: 'retryAfterSec', message: String(rateLimit.retryAfterSec ?? 60) },
        ]),
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSec ?? 60),
          },
        },
      )
    }

    // Look up all active registrations for this email (rawPrisma — public route, no org context)
    const registrations = await rawPrisma.eventRegistration.findMany({
      where: {
        email: email.toLowerCase(),
        status: { in: ['REGISTERED', 'WAITLISTED'] },
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    })

    // Issue magic links for each registration (fire-and-forget)
    // Even if none found, we return 200 — do NOT leak whether email has registrations
    if (registrations.length > 0) {
      for (const registration of registrations) {
        issueMagicLink(email.toLowerCase(), registration.id, registration.organizationId).catch(
          (err) => {
            console.error(
              `[magic-link/request] Failed to issue magic link for registration ${registration.id}:`,
              err,
            )
          },
        )
      }
    }

    // Always return the same response regardless of whether registrations exist
    return NextResponse.json(
      ok({ message: 'If you have registrations, a link has been sent to your email.' }),
    )
  } catch (error) {
    console.error('[magic-link/request] Unexpected error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong. Please try again.'),
      { status: 500 },
    )
  }
}
