/**
 * Stripe Checkout Session Creation
 *
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the caller's organization. The
 * free trial happens *before* this step (30-day no-card trial tracked on
 * Organization.trialEndsAt). By the time a user hits checkout they're
 * opting in to pay — the subscription starts immediately on success.
 *
 * The webhook handler (/api/stripe/webhook) persists the resulting
 * Subscription row after the session completes.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
// eslint-disable-next-line no-restricted-imports -- Billing checkout uses global plans and organization billing records after withAuth provides orgId.
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { logger } from '@/lib/logger'
import { PERMISSIONS } from '@/lib/permissions'

const checkoutSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
})

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

export const POST = withAuth<z.infer<typeof checkoutSchema>>(
  async ({ orgId, ctx, body }) => {
    const { planId } = body

    // 1) Verify plan exists and is configured for Stripe
    const plan = await rawPrisma.subscriptionPlan.findUnique({
      where: { id: planId },
    })
    if (!plan) {
      return NextResponse.json(fail('NOT_FOUND', 'Plan not found'), { status: 404 })
    }
    if (!plan.isActive) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Plan is not currently available'),
        { status: 400 }
      )
    }
    if (!plan.stripePriceId) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Plan not yet configured'),
        { status: 400 }
      )
    }

    // 2) Initialize Stripe
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json(
        fail(
          'SERVICE_UNAVAILABLE',
          'Billing is not yet configured. Contact your administrator.'
        ),
        { status: 503 }
      )
    }

    // 3) Fetch organization to get/create Stripe customer
    const org = await rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, stripeCustomerId: true },
    })
    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    let stripeCustomerId = org.stripeCustomerId

    try {
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: ctx.email,
          name: org.name,
          metadata: { organizationId: orgId },
        })
        stripeCustomerId = customer.id

        await rawPrisma.organization.update({
          where: { id: orgId },
          data: { stripeCustomerId: customer.id },
        })
      }
    } catch (stripeError) {
      logger.error(
        { err: stripeError, orgId },
        'Failed to create Stripe customer'
      )
      const message =
        stripeError instanceof Error
          ? stripeError.message
          : 'Failed to set up billing account'
      return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 402 })
    }

    // 4) Create Checkout Session
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
      'http://localhost:3004'

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        subscription_data: {
          metadata: {
            organizationId: orgId,
            planId: plan.id,
          },
        },
        // Charge immediately on success — the in-app 30-day trial window
        // already serves as the evaluation period; no Stripe-side trial.
        payment_method_collection: 'always',
        success_url: `${appUrl}/onboarding/plan/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/settings?tab=billing`,
        metadata: {
          organizationId: orgId,
          planId: plan.id,
        },
      })

      if (!session.url) {
        return NextResponse.json(
          fail('PAYMENT_ERROR', 'Stripe did not return a checkout URL'),
          { status: 402 }
        )
      }

      return NextResponse.json(ok({ url: session.url, sessionId: session.id }))
    } catch (stripeError) {
      logger.error(
        { err: stripeError, orgId, planId },
        'Failed to create Stripe checkout session'
      )
      const message =
        stripeError instanceof Error
          ? stripeError.message
          : 'Failed to create checkout session'
      return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 402 })
    }
  },
  { schema: checkoutSchema, permission: PERMISSIONS.SETTINGS_BILLING }
)
