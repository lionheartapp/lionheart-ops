import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

/**
 * GET /api/auth/me
 *
 * Returns user and org data for client hydration.
 * Reads JWT from httpOnly auth-token cookie (primary) or Authorization header (fallback).
 * This replaces the localStorage-based pattern in useAuth.
 */
export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/me', method: 'GET' })
  try {
    // Try cookie first, fall back to Authorization header
    const cookieToken = req.cookies.get('auth-token')?.value
    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const token = cookieToken ?? bearerToken

    if (!token) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const claims = await verifyAuthToken(token)
    if (!claims) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid or expired token'), { status: 401 })
    }

    Sentry.setTag('org_id', claims.organizationId)

    const user = await rawPrisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        schoolScope: true,
        organizationId: true,
        userRole: {
          select: { name: true },
        },
        organization: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            logoUrl: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
    }

    // Fetch first team name
    const firstMembership = await rawPrisma.userTeam.findFirst({
      where: { userId: user.id },
      select: { team: { select: { name: true } } },
    })
    const teamName = firstMembership?.team?.name ?? null

    return NextResponse.json(
      ok({
        user: {
          id: user.id,
          email: user.email,
          name: user.name || 'User',
          avatar: user.avatar ?? null,
          schoolScope: user.schoolScope ?? null,
          role: user.userRole?.name ?? null,
          team: teamName,
        },
        org: {
          id: user.organization?.id ?? user.organizationId,
          name: user.organization?.name ?? 'School',
          schoolType: user.organization?.gradeLevel ?? null,
          logoUrl: user.organization?.logoUrl ?? null,
        },
      })
    )
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch current user')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
