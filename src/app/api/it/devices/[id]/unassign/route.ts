/**
 * POST /api/it/devices/[id]/unassign — return device (end active assignment)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { unassignDevice } from '@/lib/services/itDeviceService'

export const POST = withAuth(async ({ ctx, params }) => {
  const device = await prisma.iTDevice.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!device) {
    return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
  }

  const assignment = await unassignDevice(params.id, ctx.userId)

  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.IT_DEVICE_ASSIGN })
