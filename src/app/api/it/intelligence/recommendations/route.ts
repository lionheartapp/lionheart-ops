/**
 * GET /api/it/intelligence/recommendations — devices needing attention
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getRecommendations } from '@/lib/services/itDeviceIntelligenceService'

export const GET = withAuth(async () => {
  const recommendations = await getRecommendations()

  return NextResponse.json(ok(recommendations))
}, { permission: PERMISSIONS.IT_DEVICE_INTELLIGENCE })
