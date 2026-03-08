/**
 * POST /api/it/intelligence/analyze/[deviceId] — trigger AI analysis for one device
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getAIRecommendation } from '@/lib/services/itDeviceIntelligenceService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_INTELLIGENCE)

    const recommendation = await runWithOrgContext(orgId, () =>
      getAIRecommendation(deviceId, orgId)
    )

    return NextResponse.json(ok(recommendation))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
    }
    console.error('[POST /api/it/intelligence/analyze/[deviceId]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
