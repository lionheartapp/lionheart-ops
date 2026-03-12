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
          select: { name: true, slug: true },
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

    // Fetch all team memberships for name + slugs
    const teamMemberships = await rawPrisma.userTeam.findMany({
      where: { userId: user.id },
      select: { team: { select: { name: true, slug: true } } },
    })
    const teamName = teamMemberships[0]?.team?.name ?? null
    const teamSlugs = teamMemberships.map((m) => m.team.slug)

    // Compute dashboard mode based on role slug + team membership
    const roleSlug = user.userRole?.slug ?? ''
    const isAdminRole = ['admin', 'super-admin'].includes(roleSlug)
    const isMaintenanceRole = ['maintenance-head', 'maintenance-technician'].includes(roleSlug)
    const isITRole = ['it-coordinator', 'student-technician'].includes(roleSlug)
    const isOnMaintenanceTeam = teamSlugs.includes('maintenance')
    const isOnITTeam = teamSlugs.includes('it-support')
    const isOnAVTeam = teamSlugs.includes('av-production')

    type DashboardMode = 'admin' | 'maintenance' | 'it' | 'av' | 'default'
    let dashboardMode: DashboardMode = 'default'
    if (isAdminRole) dashboardMode = 'admin'
    else if (isMaintenanceRole || isOnMaintenanceTeam) dashboardMode = 'maintenance'
    else if (isITRole || isOnITTeam) dashboardMode = 'it'
    else if (isOnAVTeam) dashboardMode = 'av'

    // Check if currently impersonating (admin-token cookie present)
    const adminToken = req.cookies.get('admin-token')?.value
    let isImpersonating = false
    let adminName: string | null = null

    if (adminToken) {
      const adminClaims = await verifyAuthToken(adminToken)
      if (adminClaims) {
        isImpersonating = true
        const adminUser = await rawPrisma.user.findUnique({
          where: { id: adminClaims.userId },
          select: { name: true },
        })
        adminName = adminUser?.name ?? 'Admin'
      }
    }

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
          dashboardMode,
        },
        org: {
          id: user.organization?.id ?? user.organizationId,
          name: user.organization?.name ?? 'School',
          schoolType: user.organization?.gradeLevel ?? null,
          logoUrl: user.organization?.logoUrl ?? null,
        },
        isImpersonating,
        adminName,
      })
    )
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch current user')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
