import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { logger } from '@/lib/logger'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

const changePlanSchema = z.object({
  planId: z.string().min(1),
  preview: z.boolean().optional().default(false),
})

function mapStripeStatus(stripeStatus: string): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED' {
  switch (stripeStatus) {
    case 'trialing': return 'TRIALING'
    case 'active': return 'ACTIVE'
    case 'past_due': return 'PAST_DUE'
    case 'canceled': return 'CANCELED'
    case 'paused': return 'PAUSED'
    default: return 'ACTIVE'
  }
}

export const POST = withAuth<z.infer<typeof changePlanSchema>>(async ({ orgId, ctx, body }) => {
  const { planId, preview } = body

  // Get target plan
  const targetPlan = await rawPrisma.subscriptionPlan.findUnique({
    where: { id: planId },
  })
  if (!targetPlan) {
    return NextResponse.json(fail('NOT_FOUND', 'Plan not found'), { status: 404 })
  }

  // Get current subscription
  const subscription = await rawPrisma.subscription.findFirst({
    where: { organizationId: orgId, status: { not: 'CANCELED' } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      fail('SERVICE_UNAVAILABLE', 'Billing is not yet configured for this organization. Contact your administrator.'),
      { status: 503 }
    )
  }

  if (!targetPlan.stripePriceId) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'The selected plan is not available for purchase at this time.'),
      { status: 400 }
    )
  }

  // Preview mode: return proration estimate without making changes
  if (preview) {
    if (!subscription?.stripeSubscriptionId) {
      // No existing subscription — no proration, just show full price
      const amount = targetPlan.monthlyPrice
      return NextResponse.json(ok({
        preview: true,
        amount,
        description: `You will be charged $${(amount / 100).toFixed(2)}/month for the ${targetPlan.name} plan.`,
      }))
    }

    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      ) as unknown as {
        items: { data: Array<{ id: string; price: { id: string } }> }
      }
      const currentPriceId = stripeSubscription.items.data[0]?.price?.id

      if (currentPriceId === targetPlan.stripePriceId) {
        return NextResponse.json(ok({
          preview: true,
          amount: 0,
          description: 'You are already on this plan.',
        }))
      }

      // Use Stripe invoices.createPreview for proration preview (Stripe v20+)
      // Falls back to showing full price if unsupported
      const upcomingInvoice = await (stripe as unknown as {
        invoices: {
          createPreview: (params: Record<string, unknown>) => Promise<{ amount_due: number }>
        }
      }).invoices.createPreview({
        customer: subscription.stripeCustomerId ?? undefined,
        subscription: subscription.stripeSubscriptionId,
        subscription_items: [
          { id: stripeSubscription.items.data[0]?.id, price: targetPlan.stripePriceId },
        ],
        subscription_proration_behavior: 'create_prorations',
      })

      return NextResponse.json(ok({
        preview: true,
        amount: upcomingInvoice.amount_due,
        description: upcomingInvoice.amount_due >= 0
          ? `You will be charged $${(upcomingInvoice.amount_due / 100).toFixed(2)} now (prorated).`
          : `You will receive a $${(Math.abs(upcomingInvoice.amount_due) / 100).toFixed(2)} credit applied to your next invoice.`,
      }))
    } catch (stripeError) {
      logger.error({ error: String(stripeError) }, 'Stripe preview error')
      // Fall back to showing full price
      const amount = targetPlan.monthlyPrice
      return NextResponse.json(ok({
        preview: true,
        amount,
        description: `Estimated charge: $${(amount / 100).toFixed(2)}/month for the ${targetPlan.name} plan.`,
      }))
    }
  }

  // Actual plan change
  if (!subscription?.stripeSubscriptionId) {
    // No existing Stripe subscription — create a new one
    let stripeCustomerId = subscription?.stripeCustomerId ?? null

    if (!stripeCustomerId) {
      // Check Organization for stripeCustomerId
      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true, name: true },
      })

      if (org?.stripeCustomerId) {
        stripeCustomerId = org.stripeCustomerId
      } else {
        // Create a new Stripe customer
        try {
          const customer = await stripe.customers.create({
            email: ctx.email,
            name: org?.name || ctx.email,
            metadata: { organizationId: orgId },
          })
          stripeCustomerId = customer.id

          // Save stripeCustomerId on Organization
          await rawPrisma.organization.update({
            where: { id: orgId },
            data: { stripeCustomerId: customer.id },
          })
        } catch (stripeError) {
          logger.error({ error: String(stripeError) }, 'Failed to create Stripe customer')
          return NextResponse.json(
            fail('INTERNAL_ERROR', 'Failed to set up billing account. Please try again.'),
            { status: 500 }
          )
        }
      }
    }

    // Create Stripe subscription
    try {
      const newStripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId!,
        items: [{ price: targetPlan.stripePriceId }],
        proration_behavior: 'create_prorations',
      }) as unknown as {
        id: string
        status: string
        current_period_start: number
        current_period_end: number
        cancel_at_period_end: boolean
      }

      // Create or update local subscription record
      if (subscription) {
        const updatedSub = await rawPrisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: targetPlan.id,
            stripeSubscriptionId: newStripeSubscription.id,
            stripeCustomerId: stripeCustomerId!,
            status: mapStripeStatus(newStripeSubscription.status),
            currentPeriodStart: new Date(newStripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(newStripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: newStripeSubscription.cancel_at_period_end || false,
          },
          include: { plan: true },
        })
        return NextResponse.json(ok({ subscription: updatedSub }))
      } else {
        const newSub = await rawPrisma.subscription.create({
          data: {
            organizationId: orgId,
            planId: targetPlan.id,
            stripeSubscriptionId: newStripeSubscription.id,
            stripeCustomerId: stripeCustomerId!,
            status: mapStripeStatus(newStripeSubscription.status),
            currentPeriodStart: new Date(newStripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(newStripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: newStripeSubscription.cancel_at_period_end || false,
          },
          include: { plan: true },
        })
        return NextResponse.json(ok({ subscription: newSub }))
      }
    } catch (stripeError) {
      logger.error({ error: String(stripeError) }, 'Failed to create Stripe subscription')
      const message = stripeError instanceof Error ? stripeError.message : 'Failed to create subscription'
      return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 402 })
    }
  }

  // Update existing Stripe subscription
  try {
    const existingSub = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    ) as unknown as {
      items: { data: Array<{ id: string; price: { id: string } }> }
    }
    const itemId = existingSub.items.data[0]?.id

    if (!itemId) {
      return NextResponse.json(
        fail('INTERNAL_ERROR', 'Could not find subscription item to update'),
        { status: 500 }
      )
    }

    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{ id: itemId, price: targetPlan.stripePriceId }],
        proration_behavior: 'create_prorations',
      }
    ) as unknown as {
      status: string
      current_period_start: number
      current_period_end: number
      cancel_at_period_end: boolean
    }

    // Update local record
    const updatedSub = await rawPrisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: targetPlan.id,
        status: mapStripeStatus(updatedStripeSubscription.status),
        currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end || false,
      },
      include: { plan: true },
    })

    return NextResponse.json(ok({ subscription: updatedSub }))
  } catch (stripeError) {
    logger.error({ error: String(stripeError) }, 'Failed to update Stripe subscription')
    const message = stripeError instanceof Error ? stripeError.message : 'Failed to update subscription'
    return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 402 })
  }
}, { permission: PERMISSIONS.SETTINGS_BILLING, schema: changePlanSchema })
