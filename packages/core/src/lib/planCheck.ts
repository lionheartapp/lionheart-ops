/**
 * Plan enforcement: block operational mutations when trial expired and no active subscription.
 * Call from API routes that perform create/update/delete on operational data.
 */
import type { PrismaClient } from '@prisma/client'

export class PlanRestrictedError extends Error {
  constructor(
    message: string,
    public readonly code: 'TRIAL_EXPIRED' | 'SUBSCRIPTION_INACTIVE' = 'TRIAL_EXPIRED'
  ) {
    super(message)
    this.name = 'PlanRestrictedError'
  }
}

/** Check if org has an active plan (trial within date or active subscription). Throws if restricted. */
export async function requireActivePlan(
  prisma: { organization: { findUnique: (args: { where: { id: string }; select?: object }) => Promise<{ trialEndsAt: Date | null; subscriptionStatus: string | null; plan: string } | null> } },
  orgId: string
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { trialEndsAt: true, subscriptionStatus: true, plan: true },
  })
  if (!org) return // withOrg already validated
  if (org.subscriptionStatus === 'active') return
  if (org.plan === 'PRO' || org.plan === 'CORE' || org.plan === 'ENTERPRISE') return
  const now = new Date()
  if (org.trialEndsAt && org.trialEndsAt > now) return
  throw new PlanRestrictedError(
    'Trial expired or subscription inactive. Please add a payment method in Settings.',
    org.trialEndsAt && org.trialEndsAt <= now ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_INACTIVE'
  )
}
