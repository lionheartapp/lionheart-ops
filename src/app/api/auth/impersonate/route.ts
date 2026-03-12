import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, signAuthToken } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { audit, getIp } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

/**
 * POST /api/auth/impersonate
 * Start impersonating a target user. Only super-admin can do this.
 * Stores admin's original token in `admin-token` cookie.
 */
export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/impersonate', method: 'POST' })
  try {
    const cookieToken = req.cookies.get('auth-token')?.value
    if (!cookieToken) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const claims = await verifyAuthToken(cookieToken)
    if (!claims) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid token'), { status: 401 })
    }

    // Verify the caller is super-admin
    const admin = await rawPrisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        name: true,
        email: true,
        organizationId: true,
        userRole: { select: { name: true } },
      },
    })

    const roleName = (admin?.userRole?.name || '').toLowerCase().replace(/\s+/g, '-')
    if (!admin || roleName !== 'super-admin') {
      return NextResponse.json(fail('FORBIDDEN', 'Only super-admin can impersonate users'), { status: 403 })
    }

    // Don't allow nested impersonation
    const existingAdminToken = req.cookies.get('admin-token')?.value
    if (existingAdminToken) {
      return NextResponse.json(fail('BAD_REQUEST', 'Already impersonating. Return to your account first.'), { status: 400 })
    }

    const body = await req.json()
    const targetUserId = body.userId

    if (!targetUserId) {
      return NextResponse.json(fail('BAD_REQUEST', 'userId is required'), { status: 400 })
    }

    if (targetUserId === admin.id) {
      return NextResponse.json(fail('BAD_REQUEST', 'Cannot impersonate yourself'), { status: 400 })
    }

    // Verify target user exists in same org
    const target = await rawPrisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        organizationId: true,
        schoolScope: true,
        userRole: { select: { name: true } },
        teams: {
          select: { team: { select: { name: true } } },
        },
      },
    })

    if (!target || target.organizationId !== admin.organizationId) {
      return NextResponse.json(fail('NOT_FOUND', 'Target user not found in this organization'), { status: 404 })
    }

    // Mint JWT for the target user
    const targetToken = await signAuthToken({
      userId: target.id,
      organizationId: target.organizationId,
      email: target.email,
    })

    const teamNames = target.teams?.map((t: any) => t.team.name).filter(Boolean) || []

    // Audit log
    void audit({
      organizationId: admin.organizationId,
      userId: admin.id,
      userEmail: admin.email,
      action: 'user.impersonate.start',
      resourceType: 'User',
      resourceId: target.id,
      resourceLabel: target.email,
      changes: { targetName: target.name, targetRole: target.userRole?.name },
      ipAddress: getIp(req),
    })

    log.info({ adminId: admin.id, targetId: target.id }, 'Impersonation started')

    const response = NextResponse.json(ok({
      user: {
        id: target.id,
        email: target.email,
        name: target.name || 'User',
        avatar: target.avatar ?? null,
        role: target.userRole?.name ?? null,
        team: teamNames[0] ?? null,
        schoolScope: target.schoolScope ?? null,
      },
    }))

    // Swap cookies: auth-token becomes target, admin-token stores original
    response.cookies.set('auth-token', targetToken, COOKIE_OPTS)
    response.cookies.set('admin-token', cookieToken, COOKIE_OPTS)

    return response
  } catch (error) {
    log.error({ err: error }, 'Impersonation failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE /api/auth/impersonate
 * End impersonation. Restore admin's original token.
 */
export async function DELETE(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/impersonate', method: 'DELETE' })
  try {
    const adminToken = req.cookies.get('admin-token')?.value
    if (!adminToken) {
      return NextResponse.json(fail('BAD_REQUEST', 'Not currently impersonating'), { status: 400 })
    }

    const adminClaims = await verifyAuthToken(adminToken)
    if (!adminClaims) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Admin token expired'), { status: 401 })
    }

    // Fetch admin profile for response
    const admin = await rawPrisma.user.findUnique({
      where: { id: adminClaims.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        schoolScope: true,
        organizationId: true,
        userRole: { select: { name: true } },
      },
    })

    if (!admin) {
      return NextResponse.json(fail('NOT_FOUND', 'Admin user not found'), { status: 404 })
    }

    // Get the impersonated user for audit log
    const currentToken = req.cookies.get('auth-token')?.value
    const currentClaims = currentToken ? await verifyAuthToken(currentToken) : null

    // Audit log
    void audit({
      organizationId: admin.organizationId,
      userId: admin.id,
      userEmail: admin.email,
      action: 'user.impersonate.end',
      resourceType: 'User',
      resourceId: currentClaims?.userId || 'unknown',
      resourceLabel: currentClaims?.email || 'unknown',
      ipAddress: getIp(req),
    })

    log.info({ adminId: admin.id }, 'Impersonation ended')

    const firstMembership = await rawPrisma.userTeam.findFirst({
      where: { userId: admin.id },
      select: { team: { select: { name: true } } },
    })

    const response = NextResponse.json(ok({
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name || 'User',
        avatar: admin.avatar ?? null,
        role: admin.userRole?.name ?? null,
        team: firstMembership?.team?.name ?? null,
        schoolScope: admin.schoolScope ?? null,
      },
    }))

    // Restore admin's token and clear admin-token
    response.cookies.set('auth-token', adminToken, COOKIE_OPTS)
    response.cookies.delete('admin-token')

    return response
  } catch (error) {
    log.error({ err: error }, 'End impersonation failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
