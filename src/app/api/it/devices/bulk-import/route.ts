/**
 * POST /api/it/devices/bulk-import — CSV bulk import of devices
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { bulkImportDevices, BulkImportSchema } from '@/lib/services/itDeviceService'

export const POST = withAuth(async ({ orgId, body }) => {
  const result = await bulkImportDevices(body, orgId)

  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.IT_DEVICE_CREATE, schema: BulkImportSchema })
