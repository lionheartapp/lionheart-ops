/**
 * MFA Email OTP — send a one-time code to the user's email
 *
 * POST — Accepts the temporary mfaToken (issued after password verification),
 * generates a 6-digit code, stores a SHA-256 hash, and emails the plaintext code.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { verifyAuthToken } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'
import { createHash, randomInt } from 'node:crypto'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { mfaEmailOtpRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'
import { sendMfaEmailCode } from '@/lib/services/email/auth-emails'

const schema = z.object({
  mfaToken: z.string().min(1, 'MFA token is required'),
})

/** Mask an email: "michael@example.com" → "m***@example.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  return `${local[0]}***@${domain}`
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await mfaEmailOtpRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many code requests. Please wait a few minutes.'),
        { status: 429, headers: getRateLimitHeaders(limitResult) }
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    const { mfaToken } = parsed.data

    // Verify the temporary MFA token
    const claims = await verifyAuthToken(mfaToken)
    if (!claims?.userId || !claims?.email) {
      return NextResponse.json(
        fail('INVALID_TOKEN', 'Invalid or expired MFA session. Please log in again.'),
        { status: 401 }
      )
    }

    // Generate a 6-digit numeric code
    const code = randomInt(100000, 999999).toString()
    const codeHash = createHash('sha256').update(code).digest('hex')

    // Opportunistic cleanup: delete expired codes older than 1 hour
    await rawPrisma.emailOtpCode.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
    })

    // Invalidate any existing unused codes for this user
    await rawPrisma.emailOtpCode.updateMany({
      where: {
        userId: claims.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    })

    // Store the new code
    await rawPrisma.emailOtpCode.create({
      data: {
        userId: claims.userId,
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    })

    // Send the email
    await sendMfaEmailCode({
      to: claims.email,
      code,
    })

    logger.info({ userId: claims.userId }, 'MFA email OTP sent')

    return NextResponse.json(ok({
      sent: true,
      maskedEmail: maskEmail(claims.email),
    }))
  } catch (err) {
    logger.error({ error: String(err) }, 'MFA email OTP error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Could not send verification code. Please try again.'),
      { status: 500 }
    )
  }
}
