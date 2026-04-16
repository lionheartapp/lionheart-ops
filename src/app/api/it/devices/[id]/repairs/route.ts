/**
 * GET /api/it/devices/[id]/repairs — list repairs for a device
 * POST /api/it/devices/[id]/repairs — log a repair
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { createRepair, listRepairs, CreateRepairSchema } from '@/lib/services/itDeviceService'

export const GET = withAuth(async ({ params }) => {
  const device = await prisma.iTDevice.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!device) {
    return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
  }

  const repairs = await listRepairs(params.id)

  return NextResponse.json(ok(repairs))
}, { permission: PERMISSIONS.IT_DEVICE_READ })

export const POST = withAuth(async ({ req, params }) => {
  const device = await prisma.iTDevice.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!device) {
    return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
  }

  const body = await req.json()
  const validated = CreateRepairSchema.parse({ ...body, deviceId: params.id })

  const repair = await createRepair(validated)

  return NextResponse.json(ok(repair), { status: 201 })
}, { permission: PERMISSIONS.IT_DEVICE_UPDATE })
