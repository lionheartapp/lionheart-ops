import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { recordPayment } from '@/lib/services/paymentService'

/**
 * Stripe webhook handler
 * Processes subscription and payment events from Stripe.
 * 
 * This endpoint is public (no auth) — Stripe signs the webhook.
 * In production, verify the signature using STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    // TODO: Verify Stripe signature when STRIPE_WEBHOOK_SECRET is configured
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    // const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

    const event = JSON.parse(body)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const existing = await rawPrisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        })
        if (existing) {
          await rawPrisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: mapStripeStatus(sub.status),
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await rawPrisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: 'CANCELED' },
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subscription = await rawPrisma.subscription.findFirst({
          where: { stripeCustomerId: invoice.customer },
        })
        if (subscription) {
          await recordPayment({
            organizationId: subscription.organizationId,
            subscriptionId: subscription.id,
            stripeInvoiceId: invoice.id,
            stripePaymentIntentId: invoice.payment_intent,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'SUCCEEDED',
            paidAt: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()),
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscription = await rawPrisma.subscription.findFirst({
          where: { stripeCustomerId: invoice.customer },
        })
        if (subscription) {
          await recordPayment({
            organizationId: subscription.organizationId,
            subscriptionId: subscription.id,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: 'FAILED',
          })
          // Mark subscription as past due
          await rawPrisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'PAST_DUE' },
          })
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json(ok({ received: true }))
  } catch (error) {
    console.error('[POST /api/platform/webhooks/stripe]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook processing failed'), { status: 500 })
  }
}

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
