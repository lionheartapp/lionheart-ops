import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)

    return await runWithOrgContext(orgId, async () => {
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
        console.error('[POST /api/settings/billing/portal] Stripe portal error:', stripeError)
        const message = stripeError instanceof Error ? stripeError.message : 'Failed to create billing portal session'
        return NextResponse.json(fail('PAYMENT_ERROR', message), { status: 502 })
      }
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
    console.error('[POST /api/settings/billing/portal]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
