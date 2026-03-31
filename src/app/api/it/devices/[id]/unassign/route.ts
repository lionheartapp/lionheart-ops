/**
 * POST /api/it/devices/[id]/unassign — return device (end active assignment)
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { unassignDevice } from '@/lib/services/itDeviceService'

export const POST = withAuth(async ({ ctx, params }) => {
  const assignment = await unassignDevice(params.id, ctx.userId)

  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.IT_DEVICE_ASSIGN })
