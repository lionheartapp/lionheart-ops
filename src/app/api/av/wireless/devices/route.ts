import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import {
  assertCanUseAV,
  createWirelessDevice,
  CreateWirelessDeviceSchema,
  listWirelessDevices,
} from '@/lib/services/avRfService'
import { PERMISSIONS } from '@/lib/permissions'

export const GET = withAuth(async ({ orgId, ctx }) => {
  await assertCanUseAV(ctx.userId)
  return NextResponse.json(ok(await listWirelessDevices(orgId)))
})

export const POST = withAuth(async ({ orgId, ctx, body }) => {
  await assertCanUseAV(ctx.userId, PERMISSIONS.AV_MANAGE)
  return NextResponse.json(ok(await createWirelessDevice(orgId, ctx.userId, body)), { status: 201 })
}, { schema: CreateWirelessDeviceSchema })

