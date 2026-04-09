/**
 * POST /api/it/student-password/reset — reset password using token
 *
 * No authentication required. Validates the token and sets the new password.
 * Rate limited per IP to prevent brute-force guessing of reset tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import * as bcrypt from 'bcryptjs'
import { resetPassword } from '@/lib/services/itStudentPasswordService'
import { logger } from '@/lib/logger'
import { studentPasswordRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

const resetSchema = z.object({
  token: z.string().trim().min(1, 'token is required').max(512),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password must be 200 characters or fewer'),
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
    const parsed = resetSchema.safeParse(raw)

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

    const { token, newPassword } = parsed.data

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Reset the password (validates token, marks used, updates user)
    const result = await resetPassword(token, passwordHash)

    return NextResponse.json(ok({
      success: result.success,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid or expired token')) {
      return NextResponse.json(
        fail('INVALID_TOKEN', 'Invalid or expired reset token'),
        { status: 400 }
      )
    }
    logger.error({ error: String(error) }, 'Student password reset failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
