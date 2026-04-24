import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'
import { logger } from '@/lib/logger'
import { invalidateOrgUserContexts } from '@/lib/cache/request-context-cache'

const GrantAccessSchema = z.object({
  /** 'free' = 100% off, 'discount' = percentage off */
  type: z.enum(['free', 'discount']),
  /** Discount percentage (1-100). Ignored when type='free' (implicitly 100%). */
  discountPercent: z.number().int().min(1).max(100).optional(),
  /** Duration in months */
  months: z.number().int().min(1).max(60),
  /** Internal note visible only to platform admins */
  note: z.string().max(500).optional(),
})

/**
 * POST /api/platform/organizations/[id]/grant-access
 *
 * Grants a school free or discounted access for a specified number of months.
 * Creates/extends a subscription, updates the org trial dates, and sets status to ACTIVE.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.SUBSCRIPTIONS_UPDATE)
    const { id } = await params

    const body = await req.json()
    const validation = GrantAccessSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', validation.error.issues), { status: 400 })
    }

    const { type, discountPercent, months, note } = validation.data
    const effectiveDiscount = type === 'free' ? 100 : (discountPercent ?? 0)

    // Verify org exists
    const org = await rawPrisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    })
    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    // Find or create a plan for granted access
    let grantPlan = await rawPrisma.subscriptionPlan.findUnique({ where: { slug: 'granted-access' } })
    if (!grantPlan) {
      grantPlan = await rawPrisma.subscriptionPlan.create({
        data: {
          name: 'Granted Access',
          slug: 'granted-access',
          monthlyPrice: 0,
          trialDays: 0,
          isActive: false, // hidden from public plan selection
          displayOrder: 999,
        },
      })
    }

    const now = new Date()
    const endsAt = new Date(now)
    endsAt.setMonth(endsAt.getMonth() + months)

    // Deactivate any existing subscriptions for this org
    await rawPrisma.subscription.updateMany({
      where: { organizationId: id, status: { in: ['ACTIVE', 'TRIALING'] } },
      data: { status: 'CANCELED' },
    })

    // Create the granted subscription
    const subscription = await rawPrisma.subscription.create({
      data: {
        organizationId: id,
        planId: grantPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: endsAt,
      },
    })

    // Set org to ACTIVE and extend trial dates so the app doesn't gate them
    await rawPrisma.organization.update({
      where: { id },
      data: {
        onboardingStatus: 'ACTIVE',
        trialStartedAt: now,
        trialEndsAt: endsAt,
      },
    })

    // Trial dates + subscription status changed for every user in this org —
    // drop their cached RequestContext so the next request rebuilds from DB.
    invalidateOrgUserContexts(id)

    const label = type === 'free'
      ? `Free access for ${months} month${months > 1 ? 's' : ''}`
      : `${effectiveDiscount}% discount for ${months} month${months > 1 ? 's' : ''}`

    // Audit log
    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'organization.grant-access',
      resourceType: 'Organization',
      resourceId: id,
      details: {
        type,
        discountPercent: effectiveDiscount,
        months,
        note: note || null,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        subscriptionId: subscription.id,
      },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: now,
        currentPeriodEnd: endsAt,
      },
      label,
      endsAt,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to grant access')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
