/**
 * POST /api/it/intelligence/analyze/[deviceId] — trigger AI analysis for one device
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAIRecommendation } from '@/lib/services/itDeviceIntelligenceService'

export const POST = withAuth(async ({ orgId, params }) => {
  const recommendation = await getAIRecommendation(params.deviceId, orgId)

  return NextResponse.json(ok(recommendation))
}, { permission: PERMISSIONS.IT_DEVICE_INTELLIGENCE })
