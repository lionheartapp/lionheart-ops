import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { hashSetupToken } from '@/lib/auth/password-setup'
import { signAuthToken } from '@/lib/auth'
import { audit, getIp } from '@/lib/services/auditService'
import { passwordSchema } from '@/lib/validation/password'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const schema = z.object({
  token: z.string().min(1, 'token is required'),
  password: passwordSchema,
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/reset-password', method: 'POST' })
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message)
      return NextResponse.json(fail('VALIDATION_ERROR', messages[0] || 'Invalid input', messages), { status: 400 })
    }

    const { token, password } = parsed.data
    const tokenHash = hashSetupToken(token)

    const setupToken = await rawPrisma.passwordSetupToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            status: true,
            organizationId: true,
            schoolScope: true,
            userRole: {
              select: { name: true },
            },
            organization: {
              select: {
                name: true,
                logoUrl: true,
                gradeLevel: true,
              },
            },
          },
        },
      },
    })

    if (!setupToken) {
      return NextResponse.json(fail('INVALID_TOKEN', 'Invalid or expired reset link'), { status: 400 })
    }

    if (setupToken.type !== 'reset') {
      return NextResponse.json(fail('INVALID_TOKEN', 'Invalid reset link'), { status: 400 })
    }

    if (setupToken.usedAt) {
      return NextResponse.json(fail('TOKEN_USED', 'This reset link has already been used'), { status: 400 })
    }

    if (setupToken.expiresAt < new Date()) {
      return NextResponse.json(fail('TOKEN_EXPIRED', 'This reset link has expired. Please request a new one.'), { status: 400 })
    }

    const user = setupToken.user

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(fail('UNAUTHORIZED', 'This account is inactive'), { status: 403 })
    }

    const passwordHash = await hash(password, 10)

    // Update password and mark token as used atomically
    await rawPrisma.$transaction([
      rawPrisma.user.update({
        where: {
          organizationId_email: {
            organizationId: user.organizationId,
            email: user.email,
          },
        },
        data: {
          passwordHash,
          emailVerified: true, // Reset link proves email ownership
        },
      }),
      rawPrisma.passwordSetupToken.update({
        where: { id: setupToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    // Sign a new JWT for auto-login
    const authToken = await signAuthToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
    })

    // Fetch team for login response shape compatibility
    const firstMembership = await rawPrisma.userTeam.findFirst({
      where: { userId: user.id },
      select: { team: { select: { name: true } } },
    })
    const teamName = firstMembership?.team?.name ?? null

    // Fire-and-forget audit log
    void audit({
      organizationId: user.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: 'user.password-reset-complete',
      resourceType: 'User',
      resourceId: user.id,
      resourceLabel: user.email,
      ipAddress: getIp(req),
    })

    // Return same shape as login for client compatibility
    const response = NextResponse.json(
      ok({
        token: authToken,
        organizationId: user.organizationId,
        organization: user.organization,
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

    // Set httpOnly auth cookie for auto-login after reset (same pattern as login endpoint)
    response.cookies.set('auth-token', authToken, {
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
  } catch (error) {
    log.error({ err: error }, 'Password reset failed')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
