import { compare } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { signAuthToken } from '@/lib/auth'
import { SignJWT } from 'jose'
import { authCookieOptions, csrfCookieOptions } from '@/lib/auth/cookie-options'
import { audit, getIp } from '@/lib/services/auditService'
import { loginRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/login', method: 'POST' })
  try {
    // ─── Rate limit check (per IP, before any body parsing) ──────────
    const ip = getIp(req) ?? 'unknown'
    const isE2ERun = req.headers.get('x-e2e-run') === 'local'
    const shouldBypassRateLimit =
      isE2ERun && (process.env.NODE_ENV !== 'production' || process.env.E2E_ALLOW_RATE_LIMIT_BYPASS === '1')

    if (!shouldBypassRateLimit) {
      const limitResult = await loginRateLimiter.hit(ip)
      if (!limitResult.allowed) {
        return NextResponse.json(
          fail('RATE_LIMITED', 'Too many login attempts. Please try again later.'),
          { status: 429, headers: getRateLimitHeaders(limitResult) }
        )
      }
    }

    const body = (await req.json()) as { email?: string; password?: string; organizationId?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const organizationId = body.organizationId?.trim()

    if (!email || !password || !organizationId) {
      return NextResponse.json(fail('BAD_REQUEST', 'email, password, and organizationId are required'), { status: 400 })
    }

    return await runWithOrgContext(organizationId, async () => {
      const user = await prisma.user.findFirst({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          campusScope: true,
          schoolId: true,
          passwordHash: true,
          status: true,
          emailVerified: true,
          organizationId: true,
          mfaEnabled: true,
          mfaSecret: true,
          _count: { select: { passkeys: true } },
          userRole: {
            select: {
              name: true,
            },
          },
        },
      })
      if (!user) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
      }

      if (user.status !== 'ACTIVE') {
        return NextResponse.json(
          fail('UNAUTHORIZED', 'Account is pending approval or inactive. Please contact an administrator.'),
          { status: 401 }
        )
      }

      const valid = user.passwordHash ? await compare(password, user.passwordHash) : false
      if (!valid) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
      }

      // Credentials valid — now check email verification (after credential check to avoid enumeration)
      if (!user.emailVerified) {
        return NextResponse.json(
          fail('EMAIL_NOT_VERIFIED', 'Please verify your email address. Check your inbox or resend the verification email.', [
            { email: user.email, organizationId },
          ]),
          { status: 403 }
        )
      }

      // Successful credential check — reset the rate limit counter for this IP
      if (!shouldBypassRateLimit) {
        await loginRateLimiter.reset(ip)
      }

      // ─── MFA check ──────────────────────────────────────────────────
      if (user.mfaEnabled) {
        // Issue a short-lived temporary token (5 minutes) for the MFA step
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
        const mfaToken = await new SignJWT({
          userId: user.id,
          organizationId,
          email: user.email,
          purpose: 'mfa',
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(secret)

        return NextResponse.json(
          ok({
            mfaRequired: true,
            mfaToken,
            hasPasskeys: (user._count?.passkeys ?? 0) > 0,
            hasTotp: !!user.mfaSecret,
          })
        )
      }

      const token = await signAuthToken({
        userId: user.id,
        organizationId,
        email: user.email,
      })

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          logoUrl: true,
          onboardingStatus: true,
        },
      })

      // Fetch teams via junction table
      const memberships = await prisma.userTeam.findMany({
        where: { userId: user.id },
        select: { team: { select: { name: true, slug: true } } },
      })
      const teamName = memberships[0]?.team?.name ?? null
      const teamSlugs = memberships.map((m) => m.team.slug)

      // Fire-and-forget audit log (non-critical)
      void audit({
        organizationId,
        userId:        user.id,
        userEmail:     user.email,
        action:        'user.login',
        resourceType:  'User',
        resourceId:    user.id,
        resourceLabel: user.email,
        ipAddress:     getIp(req),
      })

      const response = NextResponse.json(
        ok({
          token,
          organizationId,
          // `gradeLevel`/`schoolType` moved off Organization in Phase 1c ontology inversion.
          // Emit null for backward-compat; clients should migrate to reading these from
          // School/Campus endpoints.
          organization: { ...organization, gradeLevel: null, schoolType: null },
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            campusScope: user.campusScope,
            schoolId: user.schoolId,
            // Backward-compat alias — remove once clients are migrated
            schoolScope: user.campusScope,
            role: user.userRole?.name || null,
            team: teamName,
            teamSlugs,
          },
        })
      )

      // Set httpOnly auth cookie (not accessible via document.cookie)
      // Cookie domain is .lionheartapp.com in production so it follows the
      // user across tenant subdomains.
      response.cookies.set('auth-token', token, authCookieOptions())

      // Set CSRF token (non-httpOnly so JS can read it for X-CSRF-Token header)
      const csrfToken = crypto.randomUUID()
      response.cookies.set('csrf-token', csrfToken, csrfCookieOptions())

      return response
    })
  } catch (error) {
    log.error({ err: error }, 'Login failed')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
