/**
 * GET /api/trial-status — minimal trial + subscription state for the banner.
 *
 * Unlike /api/settings/billing, this endpoint has NO permission gate —
 * every authenticated user (members, viewers, etc.) can read the trial
 * state for their org. The response is deliberately minimal: no plan
 * list, no Stripe IDs, just what the top-of-app trial banner needs.
 *
 * Also returns `canManageBilling` so the banner can render a different
 * variant for users who can actually upgrade vs users who can't.
 */

import { NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Trial status is available to any authenticated user and reads minimal org subscription state by orgId.
import { rawPrisma } from '@/lib/db'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { getTrialState } from '@/lib/trial-utils'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * @authOnly Any signed-in org user may read minimal trial status; billing actions still require billing permission.
 */
export const GET = withAuth(async ({ orgId, ctx }) => {
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: {
      trialEndsAt: true,
      scheduledDeleteAt: true,
      subscriptions: {
        where: { status: { not: 'CANCELED' } },
        select: {
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const subscription = org?.subscriptions[0] ?? null
  const trialState = getTrialState({
    trialEndsAt: org?.trialEndsAt ?? null,
    subscriptionStatus: subscription?.status ?? null,
  })

  const canManageBilling = await can(ctx.userId, PERMISSIONS.SETTINGS_BILLING)

  return NextResponse.json(
    ok({
      trial: {
        endsAt: org?.trialEndsAt ?? null,
        daysLeft: trialState.daysLeft,
        inTrial: trialState.inTrial,
        expired: trialState.expired,
        readOnly: trialState.readOnly,
        paid: trialState.paid,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            scheduledDeleteAt: org?.scheduledDeleteAt ?? null,
          }
        : null,
      canManageBilling,
    })
  )
})
