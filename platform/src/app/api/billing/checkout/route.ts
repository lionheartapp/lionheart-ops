import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim()
const stripe = stripeSecret ? new Stripe(stripeSecret) : null

/** POST /api/billing/checkout — Create Stripe Checkout Session for subscription */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      if (!stripe) {
        return NextResponse.json(
          { error: 'Billing not configured (missing STRIPE_SECRET_KEY)' },
          { status: 503, headers: corsHeaders }
        )
      }
      const priceId = process.env.STRIPE_PRICE_ID_PRO || process.env.STRIPE_PRICE_ID
      if (!priceId) {
        return NextResponse.json(
          { error: 'Billing not configured (missing STRIPE_PRICE_ID)' },
          { status: 503, headers: corsHeaders }
        )
      }

      const body = (await req.json()) as { successUrl?: string; cancelUrl?: string }
      const orgId = req.headers.get('x-org-id')?.trim()
      const authHeader = req.headers.get('authorization')
      let customerEmail: string | undefined
      if (authHeader?.startsWith('Bearer ')) {
        const { verifyToken } = await import('@/lib/auth')
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.email) customerEmail = payload.email
      }

      const { getOrgId } = await import('@/lib/orgContext')
      const resolvedOrgId = getOrgId() || orgId
      if (!resolvedOrgId) {
        return NextResponse.json({ error: 'Organization required' }, { status: 401, headers: corsHeaders })
      }
      const org = await prismaBase.organization.findUnique({
        where: { id: resolvedOrgId },
        select: { id: true, name: true, stripeCustomerId: true },
      })
      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: corsHeaders })
      }

      let customerId = org.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: org.name,
          metadata: { organizationId: org.id },
        })
        customerId = customer.id
        await prismaBase.organization.update({
          where: { id: org.id },
          data: { stripeCustomerId: customerId },
        })
      }

      const baseUrl = process.env.LIONHEART_URL || process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173'
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: body.successUrl ?? `${baseUrl}/app?tab=settings&section=subscription&checkout=success`,
        cancel_url: body.cancelUrl ?? `${baseUrl}/app?tab=settings&section=subscription`,
        subscription_data: { metadata: { organizationId: org.id } },
        metadata: { organizationId: org.id },
        allow_promotion_codes: true,
      })

      return NextResponse.json(
        { url: session.url, sessionId: session.id },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    console.error('Billing checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
