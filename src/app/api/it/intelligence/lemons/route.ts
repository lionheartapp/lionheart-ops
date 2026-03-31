/**
 * GET /api/it/intelligence/lemons — flagged lemon devices
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getLemonDevices } from '@/lib/services/itDeviceIntelligenceService'

export const GET = withAuth(async () => {
  const lemons = await getLemonDevices()

  return NextResponse.json(ok(lemons))
}, { permission: PERMISSIONS.IT_DEVICE_INTELLIGENCE })
