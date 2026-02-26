import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { listSubscriptions } from '@/lib/services/subscriptionService'
import { SubscriptionStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.SUBSCRIPTIONS_READ)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const perPage = Math.min(100, parseInt(url.searchParams.get('perPage') || '25'))
    const status = url.searchParams.get('status') as SubscriptionStatus | null
    const planId = url.searchParams.get('planId')

    const result = await listSubscriptions({
      status: status || undefined,
      planId: planId || undefined,
      page,
      perPage,
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/subscriptions]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
