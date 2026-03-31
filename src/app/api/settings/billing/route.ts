import { NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'

export const GET = withAuth(async ({ orgId }) => {
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
}, { permission: PERMISSIONS.SETTINGS_BILLING })
