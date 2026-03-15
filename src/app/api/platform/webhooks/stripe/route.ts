import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { recordPayment } from '@/lib/services/paymentService'
import { verifyHmacSha256 } from '@/lib/webhook-verify'

/**
 * Stripe webhook handler
 * Processes subscription and payment events from Stripe.
 *
 * This endpoint is public (no auth) — Stripe signs the webhook.
 * Verifies the stripe-signature header using STRIPE_WEBHOOK_SECRET before processing.
 *
 * Stripe signature format: t=<timestamp>,v1=<hmac-sha256>
 * We verify the v1 component against HMAC-SHA256(<timestamp>.<body>, secret).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Missing webhook signature'), { status: 401 })
    }

    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!stripeWebhookSecret) {
      console.error('[Stripe webhook] STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook not configured'), { status: 500 })
    }

    // Parse Stripe's signature header: t=<timestamp>,v1=<hex-signature>[,v0=<legacy>]
    const parts = Object.fromEntries(
      signature.split(',').map((part) => {
        const idx = part.indexOf('=')
        return [part.slice(0, idx), part.slice(idx + 1)]
      })
    )
    const timestamp = parts['t']
    const v1Signature = parts['v1']

    if (!timestamp || !v1Signature) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid webhook signature format'), { status: 401 })
    }

    // Stripe signs: <timestamp>.<rawBody>
    const signedPayload = `${timestamp}.${rawBody}`
    const isValid = verifyHmacSha256(signedPayload, v1Signature, stripeWebhookSecret)
    if (!isValid) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid webhook signature'), { status: 401 })
    }

    const event = JSON.parse(rawBody)

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

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        const { registrationId } = paymentIntent.metadata ?? {}
        if (registrationId) {
          // This is a registration payment, not a subscription payment
          const { handlePaymentSuccess } = await import('@/lib/services/registrationPaymentService')
          await handlePaymentSuccess(paymentIntent.id)
          // Send confirmation email after payment succeeds
          try {
            const { sendConfirmationEmail } = await import('@/lib/services/registrationEmailService')
            await sendConfirmationEmail(registrationId)
          } catch (emailErr) {
            // Non-fatal: log but don't fail the webhook
            console.error('[Stripe webhook] Confirmation email failed:', emailErr)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        const { registrationId } = paymentIntent.metadata ?? {}
        if (registrationId) {
          // Update RegistrationPayment status to failed
          await rawPrisma.registrationPayment.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: { status: 'failed' },
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
