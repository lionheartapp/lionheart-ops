/**
 * GET /api/it/devices — list IT devices (filterable)
 * POST /api/it/devices — create a new IT device
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createDevice,
  listDevices,
  CreateDeviceSchema,
} from '@/lib/services/itDeviceService'
import type { ITDeviceType, ITDeviceStatus } from '@prisma/client'

export const POST = withAuth(async ({ orgId, body }) => {
  const device = await createDevice(body, orgId)

  return NextResponse.json(ok(device), { status: 201 })
}, { permission: PERMISSIONS.IT_DEVICE_CREATE, schema: CreateDeviceSchema })

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const filters = {
    deviceType: (searchParams.get('deviceType') || undefined) as ITDeviceType | undefined,
    status: (searchParams.get('status') || undefined) as ITDeviceStatus | undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    search: searchParams.get('search') || undefined,
    isLemon: searchParams.get('isLemon') === 'true' ? true : undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  }

  const result = await listDevices(filters, { userId: ctx.userId, orgId })

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEVICE_READ })
