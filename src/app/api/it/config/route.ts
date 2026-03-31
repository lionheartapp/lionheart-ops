/**
 * GET /api/it/config — org device configuration (thresholds)
 * PATCH /api/it/config — update thresholds
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getDeviceConfig,
  updateDeviceConfig,
  UpdateConfigSchema,
} from '@/lib/services/itDeviceIntelligenceService'

export const GET = withAuth(async ({ orgId }) => {
  const config = await getDeviceConfig(orgId)

  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_DEVICE_CONFIGURE })

export const PATCH = withAuth(async ({ orgId, body }) => {
  const config = await updateDeviceConfig(orgId, body)

  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_DEVICE_CONFIGURE, schema: UpdateConfigSchema })
