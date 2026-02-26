/**
 * Subscription Service
 * 
 * Manages subscription lifecycle: create, update status, check trials.
 * Uses rawPrisma — not org-scoped.
 */

import { rawPrisma } from '@/lib/db'
import { SubscriptionStatus } from '@prisma/client'

/**
 * Create a new subscription for an organization
 */
export async function createSubscription(params: {
  organizationId: string
  planId: string
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  status?: SubscriptionStatus
  trialEndsAt?: Date
}) {
  const plan = await rawPrisma.subscriptionPlan.findUnique({
    where: { id: params.planId },
  })
  if (!plan) throw new Error('Subscription plan not found')

  const now = new Date()
  const trialEndsAt = params.trialEndsAt || (plan.trialDays > 0
    ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    : null)

  return rawPrisma.subscription.create({
    data: {
      organizationId: params.organizationId,
      planId: params.planId,
      stripeSubscriptionId: params.stripeSubscriptionId || null,
      stripeCustomerId: params.stripeCustomerId || null,
      status: params.status || (trialEndsAt ? 'TRIALING' : 'ACTIVE'),
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      trialEndsAt,
    },
    include: { plan: true },
  })
}

/**
 * Update subscription status (e.g., from Stripe webhook)
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
  extra?: {
    currentPeriodStart?: Date
    currentPeriodEnd?: Date
    cancelAtPeriodEnd?: boolean
  }
) {
  return rawPrisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status,
      ...extra,
    },
    include: { plan: true },
  })
}

/**
 * Get active subscription for an organization
 */
export async function getActiveSubscription(organizationId: string) {
  return rawPrisma.subscription.findFirst({
    where: {
      organizationId,
      status: { in: ['TRIALING', 'ACTIVE'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * List all subscriptions with filters
 */
export async function listSubscriptions(params: {
  status?: SubscriptionStatus
  planId?: string
  page?: number
  perPage?: number
}) {
  const { status, planId, page = 1, perPage = 50 } = params

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (planId) where.planId = planId

  const [subscriptions, total] = await Promise.all([
    rawPrisma.subscription.findMany({
      where,
      include: {
        plan: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    rawPrisma.subscription.count({ where }),
  ])

  return { subscriptions, total, page, perPage }
}
