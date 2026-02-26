import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { queryPlatformAuditLogs } from '@/lib/services/platformAuditService'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.AUDIT_LOGS_READ)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const perPage = Math.min(100, parseInt(url.searchParams.get('perPage') || '50'))
    const adminId = url.searchParams.get('adminId')
    const action = url.searchParams.get('action')
    const resourceType = url.searchParams.get('resourceType')

    const result = await queryPlatformAuditLogs({
      adminId: adminId || undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
      page,
      perPage,
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/audit-logs]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
