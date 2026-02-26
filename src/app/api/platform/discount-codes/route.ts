import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { createDiscountCode, listDiscountCodes } from '@/lib/services/discountService'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.DISCOUNT_CODES_READ)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const perPage = Math.min(100, parseInt(url.searchParams.get('perPage') || '25'))
    const isActive = url.searchParams.get('isActive')

    const result = await listDiscountCodes({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page,
      perPage,
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/discount-codes]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.DISCOUNT_CODES_MANAGE)

    const body = await req.json()
    const { code, type, value, maxRedemptions, validFrom, validUntil, description } = body

    if (!code || !type || value === undefined) {
      return NextResponse.json(fail('BAD_REQUEST', 'code, type, and value are required'), { status: 400 })
    }

    const discount = await createDiscountCode({
      code,
      type,
      value,
      maxRedemptions: maxRedemptions || undefined,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      description,
    })

    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'discount-code.create',
      resourceType: 'DiscountCode',
      resourceId: discount.id,
      details: { code, type, value },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok(discount), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/platform/discount-codes]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
