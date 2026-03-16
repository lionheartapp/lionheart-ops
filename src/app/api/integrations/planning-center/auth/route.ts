import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as planningCenterService from '@/lib/services/integrations/planningCenterService'

/**
 * GET /api/integrations/planning-center/auth
 * Returns the PCO OAuth authorization URL.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    if (!planningCenterService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Planning Center API credentials are not configured. Contact your administrator.'),
        { status: 503 }
      )
    }

    const authUrl = planningCenterService.getAuthUrl(orgId)
    return NextResponse.json(ok({ authUrl }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
