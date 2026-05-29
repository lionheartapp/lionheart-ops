import { compare } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Platform login authenticates platform admins before any tenant org context exists.
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { signPlatformAuthToken } from '@/lib/auth/platform-auth'
import { logger } from '@/lib/logger'
import { platformLoginRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit check (per IP, before any body parsing) ──────────
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await platformLoginRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many login attempts. Please try again later.'),
        { status: 429, headers: getRateLimitHeaders(limitResult) }
      )
    }

    const body = (await req.json()) as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(fail('BAD_REQUEST', 'email and password are required'), { status: 400 })
    }

    const admin = await rawPrisma.platformAdmin.findUnique({
      where: { email },
    })

    if (!admin) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
    }

    const valid = await compare(password, admin.passwordHash)
    if (!valid) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
    }

    // Successful credential check — reset the rate limit counter for this IP
    await platformLoginRateLimiter.reset(ip)

    const token = await signPlatformAuthToken({
      adminId: admin.id,
      email: admin.email,
    })

    // Update last login time (fire and forget)
    void rawPrisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    return NextResponse.json(
      ok({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      })
    )
  } catch (error) {
    logger.error({ error: String(error) }, 'Platform login failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
