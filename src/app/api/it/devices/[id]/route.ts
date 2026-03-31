/**
 * GET /api/it/devices/[id] — device detail
 * PATCH /api/it/devices/[id] — update device
 * DELETE /api/it/devices/[id] — soft-delete device
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getDeviceDetail,
  updateDevice,
  deleteDevice,
  UpdateDeviceSchema,
} from '@/lib/services/itDeviceService'

export const GET = withAuth(async ({ params }) => {
  const device = await getDeviceDetail(params.id)

  if (!device) {
    return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
  }

  return NextResponse.json(ok(device))
}, { permission: PERMISSIONS.IT_DEVICE_READ })

export const PATCH = withAuth(async ({ params, body }) => {
  const device = await updateDevice(params.id, body)

  return NextResponse.json(ok(device))
}, { permission: PERMISSIONS.IT_DEVICE_UPDATE, schema: UpdateDeviceSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteDevice(params.id)

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.IT_DEVICE_DELETE })
