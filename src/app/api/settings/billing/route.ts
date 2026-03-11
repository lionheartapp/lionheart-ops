import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)

    return await runWithOrgContext(orgId, async () => {
      // Fetch org's active subscription with plan details
      const subscription = await rawPrisma.subscription.findFirst({
        where: { organizationId: orgId, status: { not: 'CANCELED' } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      })

      // Fetch all active plans for plan comparison
      const plans = await rawPrisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      })

      return NextResponse.json(ok({ subscription, plans }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (
      error.message.includes('Missing or invalid authorization') ||
      error.message.includes('Invalid or expired token') ||
      error.message.includes('User not found') ||
      error.message.includes('Missing x-org-id')
    )) {
      return NextResponse.json(fail('UNAUTHORIZED', error.message), { status: 401 })
    }
    console.error('[GET /api/settings/billing]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
