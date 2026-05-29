import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- Public set-password verifies one-time invite token first, then updates the token owner by organizationId/email.
import { rawPrisma as prisma, type PrismaDelegate } from '@/lib/db'
import { hashSetupToken } from '@/lib/auth/password-setup'
import { passwordSchema } from '@/lib/validation/password'
import { isPasswordBreached } from '@/lib/validation/password-breach-check'
import { ZodError } from 'zod'
import { getIp } from '@/lib/services/auditService'
import { studentPasswordRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/set-password', method: 'POST' })
  try {
    // Rate limit: 10 attempts/minute per IP to prevent token brute-force
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await studentPasswordRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many attempts. Please wait before trying again.'),
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limitResult.retryAfterMs / 1000)) } }
      )
    }

    const passwordSetupTokenModel = (prisma as unknown as Record<string, PrismaDelegate>).passwordSetupToken
    const body = (await req.json()) as { token?: string; password?: string }
    const token = body.token?.trim()
    const password = body.password?.trim()

    if (!token || !password) {
      return NextResponse.json(fail('BAD_REQUEST', 'token and password are required'), { status: 400 })
    }

    try {
      passwordSchema.parse(password)
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues[0]?.message || 'Password does not meet requirements'
        return NextResponse.json(fail('BAD_REQUEST', message), { status: 400 })
      }
      throw err
    }

    // Check if password has appeared in known data breaches
    if (await isPasswordBreached(password)) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'This password has appeared in a data breach and is not safe to use. Please choose a different password.'),
        { status: 400 }
      )
    }

    const tokenHash = hashSetupToken(token)
    const setupToken = await passwordSetupTokenModel.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            organizationId: true,
          },
        },
      },
    })

    if (!setupToken) {
      return NextResponse.json(fail('INVALID_TOKEN', 'Invalid setup token'), { status: 400 })
    }

    if (setupToken.usedAt) {
      return NextResponse.json(fail('TOKEN_USED', 'This setup link has already been used'), { status: 400 })
    }

    if (setupToken.expiresAt < new Date()) {
      return NextResponse.json(fail('TOKEN_EXPIRED', 'This setup link has expired'), { status: 400 })
    }

    const passwordHash = await hash(password, 10)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          organizationId_email: {
            organizationId: setupToken.user.organizationId,
            email: setupToken.user.email,
          },
        },
        data: {
          passwordHash,
          emailVerified: true, // Invite link proves email ownership
        },
      })
      await (tx as unknown as Record<string, PrismaDelegate>).passwordSetupToken.update({
        where: { id: setupToken.id },
        data: {
          usedAt: new Date(),
        },
      })
    })

    return NextResponse.json(ok({ success: true }))
  } catch (error) {
    log.error({ err: error }, 'Set password error')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to set password'), { status: 500 })
  }
}
