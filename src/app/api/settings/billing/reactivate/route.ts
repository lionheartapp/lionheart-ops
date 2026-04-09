/**
 * POST /api/settings/billing/reactivate
 *
 * Reverses a pending cancellation. If the subscription was scheduled to cancel
 * at period end, this un-schedules it and restores normal billing.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

export const POST = withAuth(async ({ orgId, ctx }) => {
  const subscription = await rawPrisma.subscription.findFirst({
    where: { organizationId: orgId, status: { notIn: ['CANCELED'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  })

  if (!subscription?.stripeSubscriptionId) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'No subscription to reactivate.'),
      { status: 400 }
    )
  }

  if (!subscription.cancelAtPeriodEnd) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'Subscription is not scheduled to cancel.'),
      { status: 400 }
    )
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      fail('SERVICE_UNAVAILABLE', 'Billing is not configured.'),
      { status: 503 }
    )
  }

  try {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })

    const updated = await rawPrisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false },
      include: { plan: true },
    })

    logger.info(
      { orgId, userId: ctx.userId, subscriptionId: subscription.id },
      'Subscription reactivated'
    )
    return NextResponse.json(ok({ subscription: updated }))
  } catch (stripeError) {
    logger.error({ error: String(stripeError), orgId }, 'Failed to reactivate subscription')
    const message =
      stripeError instanceof Error ? stripeError.message : 'Failed to reactivate subscription'
    return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 402 })
  }
}, { permission: PERMISSIONS.SETTINGS_BILLING })
