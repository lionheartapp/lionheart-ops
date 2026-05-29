import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
// eslint-disable-next-line no-restricted-imports -- Public Stripe webhook verifies Stripe signature before updating billing records across organizations.
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { invalidateOrgUserContexts } from '@/lib/cache/request-context-cache'

/**
 * Stripe subscription lifecycle webhook
 *
 * Handles:
 *   - customer.subscription.created   → upsert Subscription (sets status, trial, period)
 *   - customer.subscription.updated   → upsert Subscription (tracks status transitions)
 *   - customer.subscription.deleted   → mark CANCELED
 *   - invoice.payment_succeeded       → record Payment (idempotent via stripeInvoiceId)
 *   - invoice.payment_failed          → record Payment + mark Subscription PAST_DUE
 *
 * Public endpoint — Stripe signs the request. Verifies stripe-signature header
 * against STRIPE_WEBHOOK_SECRET via Stripe's constructEvent helper.
 *
 * Uses rawPrisma throughout since there is no user/org JWT on webhook calls.
 *
 * Idempotency: Stripe retries webhooks on non-2xx responses. All writes use upsert
 * or uniqueness checks so replays are safe.
 *
 * Return codes:
 *   - 200 on success or unhandled event type
 *   - 400 if signature verification fails (Stripe will stop retrying)
 *   - 500 on DB errors (Stripe will retry with exponential backoff)
 *   - 503 if STRIPE_WEBHOOK_SECRET is not configured
 */

// Next.js App Router: opt out of body parsing for raw body access.
// `req.text()` gives the exact bytes Stripe signed.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing': return 'TRIALING'
    case 'active': return 'ACTIVE'
    case 'past_due': return 'PAST_DUE'
    case 'canceled': return 'CANCELED'
    case 'unpaid': return 'PAST_DUE'
    case 'incomplete': return 'TRIALING'
    case 'incomplete_expired': return 'CANCELED'
    case 'paused': return 'PAUSED'
    default: return 'ACTIVE'
  }
}

// Stripe subscription shape — `any` would mask bugs; we narrow manually.
interface StripeSubscriptionPayload {
  id: string
  customer: string
  status: string
  current_period_start: number
  current_period_end: number
  trial_end: number | null
  cancel_at_period_end: boolean
  metadata?: Record<string, string> | null
}

interface StripeInvoicePayload {
  id: string
  customer: string | null
  subscription: string | null
  payment_intent: string | null
  amount_paid: number
  amount_due: number
  currency: string
  status_transitions?: { paid_at?: number | null } | null
  metadata?: Record<string, string> | null
}

/**
 * Upsert a Subscription row from a Stripe subscription payload.
 * Uses stripeSubscriptionId as the idempotency key.
 */
async function upsertSubscriptionFromStripe(sub: StripeSubscriptionPayload): Promise<{ upserted: boolean; reason?: string }> {
  const metadataOrgId = sub.metadata?.organizationId ?? null
  const metadataPlanId = sub.metadata?.planId ?? null

  // Try to find the existing row first — lets us update without needing metadata.
  const existing = await rawPrisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  })

  const periodStart = new Date(sub.current_period_start * 1000)
  const periodEnd = new Date(sub.current_period_end * 1000)
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null
  const status = mapStripeStatus(sub.status)

  if (existing) {
    await rawPrisma.subscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status,
        stripeCustomerId: sub.customer,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        // Only update planId if metadata provided it and it differs
        ...(metadataPlanId && metadataPlanId !== existing.planId ? { planId: metadataPlanId } : {}),
      },
    })
    // Subscription status/trial changed — affects read-only gate for every user in the org.
    invalidateOrgUserContexts(existing.organizationId)
    return { upserted: true }
  }

  // No existing row — need metadata to create one from scratch.
  if (!metadataOrgId || !metadataPlanId) {
    return { upserted: false, reason: 'missing metadata' }
  }

  // Verify org + plan exist (foreign key safety)
  const [org, plan] = await Promise.all([
    rawPrisma.organization.findUnique({ where: { id: metadataOrgId }, select: { id: true } }),
    rawPrisma.subscriptionPlan.findUnique({ where: { id: metadataPlanId }, select: { id: true } }),
  ])
  if (!org) return { upserted: false, reason: 'organization not found' }
  if (!plan) return { upserted: false, reason: 'plan not found' }

  await rawPrisma.subscription.create({
    data: {
      organizationId: metadataOrgId,
      planId: metadataPlanId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: sub.customer,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
    },
  })
  // New subscription on an org — read-only gate state may have flipped for every
  // user in the org. Drop their cached RequestContext entries.
  invalidateOrgUserContexts(metadataOrgId)
  return { upserted: true }
}

export async function POST(req: NextRequest) {
  // Raw body is required for signature verification — must be read before anything else.
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeWebhookSecret) {
    logger.warn('STRIPE_WEBHOOK_SECRET not configured — webhook rejected')
    return NextResponse.json(
      fail('SERVICE_UNAVAILABLE', 'Webhook endpoint is not configured'),
      { status: 503 }
    )
  }

  if (!signature) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'Missing stripe-signature header'),
      { status: 400 }
    )
  }

  const stripe = getStripe()
  if (!stripe) {
    logger.warn('STRIPE_SECRET_KEY not configured — cannot verify webhook')
    return NextResponse.json(
      fail('SERVICE_UNAVAILABLE', 'Stripe is not configured'),
      { status: 503 }
    )
  }

  // Verify signature via Stripe SDK
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret)
  } catch (verifyError) {
    logger.warn({ error: String(verifyError) }, 'Stripe webhook signature verification failed')
    return NextResponse.json(
      fail('BAD_REQUEST', 'Invalid webhook signature'),
      { status: 400 }
    )
  }

  // Dispatch by event type. Any thrown error in a case returns 500 so Stripe retries.
  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        const sub = event.data.object as unknown as StripeSubscriptionPayload
        const result = await upsertSubscriptionFromStripe(sub)
        if (!result.upserted) {
          logger.warn(
            { eventType: event.type, stripeSubscriptionId: sub.id, reason: result.reason },
            'Subscription create skipped — not our sub'
          )
        } else {
          logger.info(
            { eventType: event.type, stripeSubscriptionId: sub.id, status: mapStripeStatus(sub.status) },
            'Subscription created'
          )
        }
        return NextResponse.json(ok({ received: true }))
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as unknown as StripeSubscriptionPayload
        const result = await upsertSubscriptionFromStripe(sub)
        if (!result.upserted) {
          logger.warn(
            { eventType: event.type, stripeSubscriptionId: sub.id, reason: result.reason },
            'Subscription update skipped — no local row and missing metadata'
          )
        } else {
          logger.info(
            { eventType: event.type, stripeSubscriptionId: sub.id, status: mapStripeStatus(sub.status) },
            'Subscription updated'
          )
        }
        return NextResponse.json(ok({ received: true }))
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as unknown as StripeSubscriptionPayload
        // Look up the org before updating so we know whose caches to clear.
        const existing = await rawPrisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
          select: { organizationId: true },
        })
        const result = await rawPrisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: 'CANCELED', cancelAtPeriodEnd: false },
        })
        if (existing) {
          // Subscription canceled — every user in the org will now see the
          // read-only gate. Invalidate their cached context.
          invalidateOrgUserContexts(existing.organizationId)
        }
        logger.info(
          { eventType: event.type, stripeSubscriptionId: sub.id, updated: result.count },
          'Subscription canceled'
        )
        return NextResponse.json(ok({ received: true }))
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as unknown as StripeInvoicePayload

        // Determine the organization: prefer subscription lookup, fall back to customer.
        let subscription = null
        if (invoice.subscription) {
          subscription = await rawPrisma.subscription.findUnique({
            where: { stripeSubscriptionId: invoice.subscription },
          })
        }
        if (!subscription && invoice.customer) {
          subscription = await rawPrisma.subscription.findFirst({
            where: { stripeCustomerId: invoice.customer },
            orderBy: { createdAt: 'desc' },
          })
        }

        if (!subscription) {
          logger.warn(
            { eventType: event.type, stripeInvoiceId: invoice.id },
            'Payment succeeded but no local subscription found — skipping'
          )
          return NextResponse.json(ok({ received: true }))
        }

        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date()

        // Idempotent: stripeInvoiceId is @unique. Use upsert so a retried webhook
        // doesn't create a duplicate Payment row.
        if (invoice.id) {
          await rawPrisma.payment.upsert({
            where: { stripeInvoiceId: invoice.id },
            create: {
              organizationId: subscription.organizationId,
              subscriptionId: subscription.id,
              stripeInvoiceId: invoice.id,
              stripePaymentIntentId: invoice.payment_intent,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'SUCCEEDED',
              paidAt,
            },
            update: {
              status: 'SUCCEEDED',
              amount: invoice.amount_paid,
              paidAt,
              stripePaymentIntentId: invoice.payment_intent,
            },
          })
        } else {
          // No invoice id: fall back to create (extremely rare).
          await rawPrisma.payment.create({
            data: {
              organizationId: subscription.organizationId,
              subscriptionId: subscription.id,
              stripePaymentIntentId: invoice.payment_intent,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'SUCCEEDED',
              paidAt,
            },
          })
        }

        logger.info(
          {
            eventType: event.type,
            stripeInvoiceId: invoice.id,
            subscriptionId: subscription.id,
            amount: invoice.amount_paid,
          },
          'Payment recorded'
        )
        return NextResponse.json(ok({ received: true }))
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as StripeInvoicePayload

        let subscription = null
        if (invoice.subscription) {
          subscription = await rawPrisma.subscription.findUnique({
            where: { stripeSubscriptionId: invoice.subscription },
          })
        }
        if (!subscription && invoice.customer) {
          subscription = await rawPrisma.subscription.findFirst({
            where: { stripeCustomerId: invoice.customer },
            orderBy: { createdAt: 'desc' },
          })
        }

        if (!subscription) {
          logger.warn(
            { eventType: event.type, stripeInvoiceId: invoice.id },
            'Payment failed but no local subscription found — skipping'
          )
          return NextResponse.json(ok({ received: true }))
        }

        // Record failed payment (idempotent via stripeInvoiceId).
        if (invoice.id) {
          await rawPrisma.payment.upsert({
            where: { stripeInvoiceId: invoice.id },
            create: {
              organizationId: subscription.organizationId,
              subscriptionId: subscription.id,
              stripeInvoiceId: invoice.id,
              stripePaymentIntentId: invoice.payment_intent,
              amount: invoice.amount_due,
              currency: invoice.currency,
              status: 'FAILED',
              paidAt: null,
            },
            update: {
              status: 'FAILED',
              amount: invoice.amount_due,
              stripePaymentIntentId: invoice.payment_intent,
            },
          })
        } else {
          await rawPrisma.payment.create({
            data: {
              organizationId: subscription.organizationId,
              subscriptionId: subscription.id,
              stripePaymentIntentId: invoice.payment_intent,
              amount: invoice.amount_due,
              currency: invoice.currency,
              status: 'FAILED',
            },
          })
        }

        // Promote subscription to PAST_DUE if not already in a terminal state.
        if (subscription.status !== 'PAST_DUE' && subscription.status !== 'CANCELED') {
          await rawPrisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'PAST_DUE' },
          })
          // Status transition affects the read-only gate for every user in the org.
          invalidateOrgUserContexts(subscription.organizationId)
        }

        logger.info(
          {
            eventType: event.type,
            stripeInvoiceId: invoice.id,
            subscriptionId: subscription.id,
            amount: invoice.amount_due,
          },
          'Payment failed — subscription marked PAST_DUE'
        )
        return NextResponse.json(ok({ received: true }))
      }

      case 'payment_intent.succeeded': {
        // Handle FormOrder ticket fulfillment
        const pi = event.data.object as { id: string; metadata?: Record<string, string> | null }
        const formOrderId = pi.metadata?.formOrderId
        if (formOrderId) {
          try {
            const { fulfillOrder } = await import('@/lib/services/eventTicketService')
            await fulfillOrder(formOrderId)
            logger.info(
              { eventType: event.type, formOrderId, paymentIntentId: pi.id },
              'FormOrder fulfilled — tickets generated and email sent'
            )
          } catch (err) {
            logger.error(
              { eventType: event.type, formOrderId, error: String(err) },
              'FormOrder fulfillment failed'
            )
            return NextResponse.json(fail('INTERNAL_ERROR', 'Fulfillment failed'), { status: 500 })
          }
        }
        return NextResponse.json(ok({ received: true }))
      }

      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe event type — ignored')
        return NextResponse.json(ok({ received: true, handled: false }))
    }
  } catch (error) {
    // DB or unexpected error — return 500 so Stripe retries.
    logger.error(
      { eventType: event.type, error: String(error) },
      'Stripe webhook handler failed'
    )
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Webhook processing failed'),
      { status: 500 }
    )
  }
}
