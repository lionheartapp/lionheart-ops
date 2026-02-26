import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.PLANS_MANAGE)

    const plans = await rawPrisma.subscriptionPlan.findMany({
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json(ok(plans))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/plans]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.PLANS_MANAGE)

    const body = await req.json()
    const { name, slug, monthlyPrice, annualPrice, features, trialDays, stripePriceId, displayOrder } = body

    if (!name || !slug) {
      return NextResponse.json(fail('BAD_REQUEST', 'name and slug are required'), { status: 400 })
    }

    const plan = await rawPrisma.subscriptionPlan.create({
      data: {
        name,
        slug: slug.toLowerCase().trim(),
        monthlyPrice: monthlyPrice || 0,
        annualPrice: annualPrice || null,
        features: features || null,
        trialDays: trialDays || 0,
        stripePriceId: stripePriceId || null,
        displayOrder: displayOrder || 0,
        isActive: true,
      },
    })

    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'plan.create',
      resourceType: 'SubscriptionPlan',
      resourceId: plan.id,
      details: { name, slug },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok(plan), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/platform/plans]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
