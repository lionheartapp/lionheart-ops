import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prismaBase } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim()
const stripe = stripeSecret ? new Stripe(stripeSecret) : null
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

/** POST /api/billing/webhook — Stripe webhook (customer.subscription.*, invoice.paid) */
export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    console.error('Stripe or STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503, headers: corsHeaders })
  }

  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400, headers: corsHeaders })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new NextResponse('Webhook signature verification failed', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.organizationId
        if (orgId) {
          const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled'
          await prismaBase.organization.update({
            where: { id: orgId },
            data: {
              stripeSubscriptionId: sub.id,
              subscriptionStatus: status,
              plan: status === 'active' ? 'PRO' : 'PRO_TRIAL',
            },
          })
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.organizationId
        if (orgId) {
          await prismaBase.organization.update({
            where: { id: orgId },
            data: {
              stripeSubscriptionId: null,
              subscriptionStatus: 'canceled',
              plan: 'PRO_TRIAL',
            },
          })
        }
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } }
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const orgId = sub.metadata?.organizationId
          if (orgId) {
            await prismaBase.organization.update({
              where: { id: orgId },
              data: {
                subscriptionStatus: 'active',
                plan: 'PRO',
              },
            })
          }
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } }
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const orgId = sub.metadata?.organizationId
          if (orgId) {
            await prismaBase.organization.update({
              where: { id: orgId },
              data: { subscriptionStatus: 'past_due' },
            })
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500, headers: corsHeaders })
  }

  return new NextResponse('OK', { status: 200 })
}
