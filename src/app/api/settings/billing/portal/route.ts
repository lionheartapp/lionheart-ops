import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

export const POST = withAuth(async ({ orgId, req }) => {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      fail('SERVICE_UNAVAILABLE', 'Billing is not yet configured for this organization. Contact your administrator.'),
      { status: 503 }
    )
  }

  // Get the org's active subscription to find stripeCustomerId
  const subscription = await rawPrisma.subscription.findFirst({
    where: { organizationId: orgId, status: { not: 'CANCELED' } },
    orderBy: { createdAt: 'desc' },
  })

  // Also check Organization directly for stripeCustomerId
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true },
  })

  const stripeCustomerId = subscription?.stripeCustomerId ?? org?.stripeCustomerId ?? null

  if (!stripeCustomerId) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'No billing account configured. Please select a plan first to set up billing.'),
      { status: 400 }
    )
  }

  // Determine return URL
  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3004'
  const returnUrl = `${origin}/settings`

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })

    return NextResponse.json(ok({ url: session.url }))
  } catch (stripeError) {
    logger.error({ error: String(stripeError) }, 'Stripe portal error')
    const message = stripeError instanceof Error ? stripeError.message : 'Failed to create billing portal session'
    return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 502 })
  }
}, { permission: PERMISSIONS.SETTINGS_BILLING })
