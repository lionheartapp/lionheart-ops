import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'
import { logger } from '@/lib/logger'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.DISCOUNT_CODES_MANAGE)
    const { id } = await params

    const body = await req.json()
    const allowedFields = ['isActive', 'validUntil', 'maxRedemptions', 'description']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = field === 'validUntil' && body[field] ? new Date(body[field]) : body[field]
      }
    }

    const code = await rawPrisma.discountCode.update({
      where: { id },
      data,
    })

    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'discount-code.update',
      resourceType: 'DiscountCode',
      resourceId: id,
      details: { changes: data },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok(code))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to update discount code')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
