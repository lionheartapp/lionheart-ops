/**
 * Passkey Authentication Verify — verifies assertion and issues auth token.
 * Public route (uses temporary MFA token).
 * Mirrors the pattern in /api/auth/mfa/verify/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { signAuthToken, verifyAuthToken } from '@/lib/auth'
import { verifyAuthentication } from '@/lib/services/passkeyService'
import { authCookieOptions, csrfCookieOptions } from '@/lib/auth/cookie-options'
import { rawPrisma } from '@/lib/db'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { mfaRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

const schema = z.object({
  mfaToken: z.string().min(1, 'MFA token is required'),
  credential: z.record(z.string(), z.unknown()),
  challengeId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit: shares the MFA limiter (5 attempts per 5 minutes per IP)
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

    const { mfaToken, credential, challengeId } = parsed.data

    // Verify the temporary MFA token
    const claims = await verifyAuthToken(mfaToken)
    if (!claims?.userId || !claims?.organizationId) {
      return NextResponse.json(
        fail('INVALID_TOKEN', 'Invalid or expired MFA session. Please log in again.'),
        { status: 401 }
      )
    }

    // Verify the passkey assertion
    const valid = await verifyAuthentication(claims.userId, credential as never, challengeId)
    if (!valid) {
      return NextResponse.json(
        fail('INVALID_CREDENTIAL', 'Passkey verification failed. Please try again.'),
        { status: 400 }
      )
    }

    // Issue the real auth token (same pattern as mfa/verify)
    const token = await signAuthToken({
      userId: claims.userId,
      organizationId: claims.organizationId,
      email: claims.email,
    })

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

    logger.info({ userId: claims.userId }, 'Passkey authentication successful')

    return response
  } catch (err) {
    logger.error({ error: String(err) }, 'Passkey authentication verify error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Passkey verification failed'),
      { status: 500 }
    )
  }
}
