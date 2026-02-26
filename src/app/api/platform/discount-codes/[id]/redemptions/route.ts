import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { getDiscountRedemptions } from '@/lib/services/discountService'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.DISCOUNT_CODES_READ)
    const { id } = await params

    const redemptions = await getDiscountRedemptions(id)
    return NextResponse.json(ok(redemptions))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/discount-codes/[id]/redemptions]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
