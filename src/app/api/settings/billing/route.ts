import { NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Billing settings reads org trial/subscription state by orgId after withAuth/permission checks.
import { rawPrisma } from '@/lib/db'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTrialState } from '@/lib/trial-utils'

export const GET = withAuth(async ({ orgId }) => {
  // Fetch the org's trial window and latest (non-canceled) subscription
  // in a single round trip. Both feed the trial banner + BillingTab.
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: {
      trialStartedAt: true,
      trialEndsAt: true,
    },
  })

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

  const trialState = getTrialState({
    trialEndsAt: org?.trialEndsAt ?? null,
    subscriptionStatus: subscription?.status ?? null,
  })

  return NextResponse.json(
    ok({
      subscription,
      plans,
      trial: {
        startedAt: org?.trialStartedAt ?? null,
        endsAt: org?.trialEndsAt ?? null,
        daysLeft: trialState.daysLeft,
        inTrial: trialState.inTrial,
        expired: trialState.expired,
        paid: trialState.paid,
        readOnly: trialState.readOnly,
      },
    })
  )
}, { permission: PERMISSIONS.SETTINGS_BILLING })
