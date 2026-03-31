/**
 * GET /api/it/devices/[id]/history — device assignment + repair timeline
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getDeviceHistory } from '@/lib/services/itDeviceService'

export const GET = withAuth(async ({ params }) => {
  const history = await getDeviceHistory(params.id)

  return NextResponse.json(ok(history))
}, { permission: PERMISSIONS.IT_DEVICE_READ })
