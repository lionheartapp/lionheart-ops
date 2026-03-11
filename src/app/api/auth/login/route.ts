import { compare } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { signAuthToken } from '@/lib/auth'
import { audit, getIp } from '@/lib/services/auditService'
import { loginRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/login', method: 'POST' })
  try {
    // ─── Rate limit check (per IP, before any body parsing) ──────────
    const ip = getIp(req) ?? 'unknown'
    loginRateLimiter.increment(ip)
    const limitResult = loginRateLimiter.check(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many login attempts. Please try again later.'),
        { status: 429, headers: getRateLimitHeaders(limitResult) }
      )
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
          schoolScope: true,
          passwordHash: true,
          status: true,
          emailVerified: true,
          organizationId: true,
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
      loginRateLimiter.reset(ip)

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
          gradeLevel: true,
        },
      })

      // Fetch team via junction table (take just one for display in the login response)
      const firstMembership = await prisma.userTeam.findFirst({
        where: { userId: user.id },
        select: { team: { select: { name: true } } },
      })
      const teamName = firstMembership?.team?.name ?? null

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
          organization,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            schoolScope: user.schoolScope,
            role: user.userRole?.name || null,
            team: teamName,
          },
        })
      )

      // Set httpOnly auth cookie (not accessible via document.cookie)
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      })

      // Set CSRF token (non-httpOnly so JS can read it for X-CSRF-Token header)
      const csrfToken = crypto.randomUUID()
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      })

      return response
    })
  } catch (error) {
    log.error({ err: error }, 'Login failed')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
