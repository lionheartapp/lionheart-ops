/**
 * POST /api/settings/billing/cancel
 *
 * Cancels the organization's Stripe subscription. Default: cancel at period end
 * (user keeps access until currentPeriodEnd). If `immediate: true`, cancels now.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
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

const cancelSchema = z.object({
  immediate: z.boolean().optional().default(false),
})

export const POST = withAuth<z.infer<typeof cancelSchema>>(async ({ orgId, body, ctx }) => {
  const { immediate } = body

  const subscription = await rawPrisma.subscription.findFirst({
    where: { organizationId: orgId, status: { notIn: ['CANCELED'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  })

  if (!subscription?.stripeSubscriptionId) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'No active subscription to cancel.'),
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
    if (immediate) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      const updated = await rawPrisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED', cancelAtPeriodEnd: false },
        include: { plan: true },
      })
      logger.info(
        { orgId, userId: ctx.userId, subscriptionId: subscription.id },
        'Subscription canceled immediately'
      )
      return NextResponse.json(ok({ subscription: updated }))
    }

    const stripeSub = (await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    )) as unknown as {
      cancel_at_period_end: boolean
      current_period_end: number
    }

    const updated = await rawPrisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      },
      include: { plan: true },
    })
    logger.info(
      { orgId, userId: ctx.userId, subscriptionId: subscription.id },
      'Subscription scheduled to cancel at period end'
    )
    return NextResponse.json(ok({ subscription: updated }))
  } catch (stripeError) {
    logger.error({ error: String(stripeError), orgId }, 'Failed to cancel subscription')
    const message =
      stripeError instanceof Error ? stripeError.message : 'Failed to cancel subscription'
    return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 402 })
  }
}, { permission: PERMISSIONS.SETTINGS_BILLING, schema: cancelSchema })
