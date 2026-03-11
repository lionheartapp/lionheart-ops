import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { hashSetupToken } from '@/lib/auth/password-setup'
import { signAuthToken } from '@/lib/auth'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/verify-email', method: 'GET' })
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/verify-email'
    url.search = '?error=invalid'
    return NextResponse.redirect(url, 302)
  }

  try {
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
            emailVerified: true,
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

    // Token not found
    if (!setupToken || setupToken.type !== 'email-verification') {
      const url = req.nextUrl.clone()
      url.pathname = '/verify-email'
      url.search = '?error=invalid'
      return NextResponse.redirect(url, 302)
    }

    // Token already used
    if (setupToken.usedAt) {
      const url = req.nextUrl.clone()
      url.pathname = '/verify-email'
      url.search = '?error=invalid'
      return NextResponse.redirect(url, 302)
    }

    // Token expired
    if (setupToken.expiresAt < new Date()) {
      const url = req.nextUrl.clone()
      url.pathname = '/verify-email'
      url.search = '?error=expired'
      return NextResponse.redirect(url, 302)
    }

    const user = setupToken.user

    // Mark email as verified, activate user if PENDING, mark token used
    await rawPrisma.$transaction([
      rawPrisma.user.update({
        where: {
          organizationId_email: {
            organizationId: user.organizationId,
            email: user.email,
          },
        },
        data: {
          emailVerified: true,
          ...(user.status === 'PENDING' ? { status: 'ACTIVE' } : {}),
        },
      }),
      rawPrisma.passwordSetupToken.update({
        where: { id: setupToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    // Sign JWT for auto-login
    const authToken = await signAuthToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
    })

    // Redirect to dashboard with auth cookie set
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    const response = NextResponse.redirect(url, 302)

    response.cookies.set('auth-token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

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
    log.error({ err: error }, 'Email verification failed')
    Sentry.captureException(error)
    const url = req.nextUrl.clone()
    url.pathname = '/verify-email'
    url.search = '?error=invalid'
    return NextResponse.redirect(url, 302)
  }
}
