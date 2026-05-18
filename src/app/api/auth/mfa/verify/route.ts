/**
 * MFA Verify API — used during login
 *
 * POST — Verify a TOTP code or backup code to complete login.
 * Requires a temporary MFA token (issued by /api/auth/login when MFA is enabled).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { signAuthToken, verifyAuthToken } from '@/lib/auth'
import { verifyMfaForLogin } from '@/lib/services/mfaService'
import { authCookieOptions, csrfCookieOptions } from '@/lib/auth/cookie-options'
import { rawPrisma } from '@/lib/db'
import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { mfaRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

const schema = z.object({
  mfaToken: z.string().min(1, 'MFA token is required'),
  code: z.string().min(1, 'Verification code is required'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per 5 minutes per IP (TOTP codes are 6 digits — brute-forceable)
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await mfaRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many verification attempts. Please wait a few minutes.'),
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

    const { mfaToken, code } = parsed.data

    // Verify the temporary MFA token (same JWT format, short-lived)
    const claims = await verifyAuthToken(mfaToken)
    if (!claims?.userId || !claims?.organizationId) {
      return NextResponse.json(fail('INVALID_TOKEN', 'Invalid or expired MFA session. Please log in again.'), { status: 401 })
    }

    // Verify the TOTP code, backup code, or email OTP
    const normalizedCode = code.replace(/-/g, '').trim()
    let valid = await verifyMfaForLogin(claims.userId, normalizedCode)

    // Fallback: check email OTP codes
    if (!valid) {
      const codeHash = createHash('sha256').update(normalizedCode).digest('hex')
      const otpRecord = await rawPrisma.emailOtpCode.findFirst({
        where: {
          userId: claims.userId,
          codeHash,
          expiresAt: { gt: new Date() },
          usedAt: null,
        },
      })
      if (otpRecord) {
        valid = true
        await rawPrisma.emailOtpCode.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() },
        })
      }
    }

    if (!valid) {
      return NextResponse.json(fail('INVALID_CODE', 'Invalid verification code. Please try again.'), { status: 400 })
    }

    // MFA verified — issue the real auth token
    const token = await signAuthToken({
      userId: claims.userId,
      organizationId: claims.organizationId,
      email: claims.email,
    })

    // Fetch user data for the response (same as login route)
    const user = await rawPrisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        campusScope: true,
        userRole: { select: { name: true } },
        teams: { select: { team: { select: { id: true, slug: true } } } },
      },
    })

    const org = await rawPrisma.organization.findUnique({
      where: { id: claims.organizationId },
      select: { id: true, name: true, slug: true },
    })

    // Set cookies
    const csrfToken = randomUUID()
    const response = NextResponse.json(ok({
      token,
      organizationId: claims.organizationId,
      organization: org,
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        avatar: user?.avatar,
        campusScope: user?.campusScope,
        // Backward-compat alias — remove once clients are migrated
        schoolScope: user?.campusScope,
        role: user?.userRole?.name || 'member',
        team: user?.teams?.[0]?.team?.slug || null,
        teamSlugs: user?.teams?.map((t: { team: { slug: string } }) => t.team.slug) || [],
      },
    }))

    response.cookies.set('auth-token', token, authCookieOptions())
    response.cookies.set('csrf-token', csrfToken, csrfCookieOptions())

    logger.info({ userId: claims.userId }, 'MFA verification successful')

    return response
  } catch (err) {
    logger.error({ error: String(err) }, 'MFA verification error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Verification failed'),
      { status: 500 }
    )
  }
}
