/**
 * POST /api/settings/organization/delete
 *
 * Schedules an organization for deletion with a 30-day grace period.
 * - Cancels the Stripe subscription immediately (so the org isn't billed)
 * - Marks org as CHURNED and sets scheduledDeleteAt = now + 30 days
 * - A separate cron job (scripts/cleanup-churned-orgs.mjs) hard-deletes the
 *   org after the grace period expires.
 *
 * Requires super-admin role. User must confirm by typing the org name exactly.
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

const deleteSchema = z.object({
  confirmationText: z.string().min(1, 'Confirmation required'),
})

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

export const POST = withAuth<z.infer<typeof deleteSchema>>(async ({ orgId, body, ctx }) => {
  // Only super-admins can delete an organization
  if (ctx.roleName !== 'super-admin') {
    return NextResponse.json(
      fail('FORBIDDEN', 'Only organization super-admins can delete the organization.'),
      { status: 403 }
    )
  }

  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      scheduledDeleteAt: true,
    },
  })

  if (!org) {
    return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
  }

  if (org.scheduledDeleteAt) {
    return NextResponse.json(
      fail('CONFLICT', 'Organization is already scheduled for deletion.'),
      { status: 409 }
    )
  }

  if (body.confirmationText.trim() !== org.name) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Confirmation text does not match organization name.'),
      { status: 400 }
    )
  }

  // Cancel active Stripe subscription (immediate, not at period end — we're
  // closing the account, don't keep billing them).
  const subscription = await rawPrisma.subscription.findFirst({
    where: { organizationId: orgId, status: { notIn: ['CANCELED'] } },
    orderBy: { createdAt: 'desc' },
  })

  if (subscription?.stripeSubscriptionId) {
    const stripe = getStripe()
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
        await rawPrisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', cancelAtPeriodEnd: false },
        })
      } catch (stripeError) {
        logger.error(
          { error: String(stripeError), orgId },
          'Failed to cancel Stripe subscription during org deletion — continuing'
        )
        // Don't block deletion on Stripe failure — the cron cleanup will retry
      }
    }
  }

  const scheduledDeleteAt = new Date(Date.now() + GRACE_PERIOD_MS)

  const updated = await rawPrisma.organization.update({
    where: { id: orgId },
    data: {
      onboardingStatus: 'CHURNED',
      scheduledDeleteAt,
    },
    select: {
      id: true,
      name: true,
      scheduledDeleteAt: true,
      onboardingStatus: true,
    },
  })

  logger.warn(
    { orgId, userId: ctx.userId, scheduledDeleteAt },
    'Organization scheduled for deletion (30-day grace period)'
  )

  return NextResponse.json(
    ok({
      organization: updated,
      scheduledDeleteAt: updated.scheduledDeleteAt,
      message:
        'Organization scheduled for deletion in 30 days. Contact support to restore before then.',
    })
  )
}, { permission: PERMISSIONS.SETTINGS_BILLING, schema: deleteSchema })
