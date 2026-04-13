import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { logger } from '@/lib/logger'

/**
 * GET /api/platform/stats — Dashboard statistics including MRR
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)

    const [
      totalOrgs,
      activeOrgs,
      suspendedOrgs,
      openTickets,
      totalUsers,
      activeSubscriptions,
      recentOrgs,
    ] = await Promise.all([
      rawPrisma.organization.count(),
      rawPrisma.organization.count({ where: { onboardingStatus: 'ACTIVE' } }),
      rawPrisma.organization.count({ where: { onboardingStatus: 'SUSPENDED' } }),
      rawPrisma.platformSupportTicket.count({ where: { status: 'OPEN' } }),
      rawPrisma.user.count({ where: { deletedAt: null } }),
      rawPrisma.subscription.findMany({
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        select: {
          status: true,
          plan: { select: { monthlyPrice: true } },
        },
      }),
      rawPrisma.organization.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          onboardingStatus: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
    ])

    // Calculate MRR from active subscriptions (monthlyPrice is in cents)
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      return sum + (sub.plan?.monthlyPrice || 0)
    }, 0)

    const trialOrgs = activeSubscriptions.filter(s => s.status === 'TRIALING').length

    return NextResponse.json(ok({
      totalOrgs,
      activeOrgs,
      suspendedOrgs,
      trialOrgs,
      openTickets,
      totalUsers,
      mrr, // in cents
      recentOrgs,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to fetch platform stats')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
