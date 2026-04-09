/**
 * POST /api/it/student-password/request — request a password reset token
 *
 * No authentication required. Verifies student exists and email matches,
 * then generates a reset token. Rate limited per IP to prevent abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import {
  lookupStudent,
  generateResetToken,
} from '@/lib/services/itStudentPasswordService'
import { sendPasswordResetEmail } from '@/lib/services/emailService'
import { logger } from '@/lib/logger'
import { studentPasswordRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

const requestSchema = z.object({
  orgSlug: z.string().trim().min(1, 'orgSlug is required').max(200),
  studentId: z.string().trim().min(1, 'studentId is required').max(200),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(320),
})

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit check (per IP, before any body parsing) ──────────
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await studentPasswordRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many requests. Please try again later.'),
        { status: 429, headers: getRateLimitHeaders(limitResult) }
      )
    }

    const raw = await req.json().catch(() => null)
    const parsed = requestSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        fail(
          'VALIDATION_ERROR',
          'Invalid input',
          parsed.error.issues.map((e) => e.message)
        ),
        { status: 400 }
      )
    }

    const { orgSlug, studentId, email } = parsed.data

    // Look up org by slug
    const org = await rawPrisma.organization.findFirst({
      where: { slug: orgSlug },
      select: { id: true, name: true },
    })

    if (!org) {
      // Generic error to avoid leaking org existence
      return NextResponse.json(
        fail('NOT_FOUND', 'Unable to process request'),
        { status: 404 }
      )
    }

    // Verify student exists and email matches
    const student = await lookupStudent(org.id, { studentId })

    if (!student || student.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Student not found or email does not match'),
        { status: 404 }
      )
    }

    // Generate reset token and send via email
    const { token, expiresAt } = await generateResetToken(org.id, student.id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.lionheartapp.com'
    const resetLink = `${appUrl}/it/password-reset?token=${encodeURIComponent(token)}`

    await sendPasswordResetEmail({
      to: student.email!,
      firstName: student.firstName || 'Student',
      orgName: org.name,
      resetLink,
    })

    return NextResponse.json(ok({
      success: true,
      message: 'If that account exists, a reset link has been sent to the associated email address.',
    }))
  } catch (error) {
    logger.error({ error: String(error) }, 'Student password reset request failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
