import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { assertCanUseAV, coordinateFrequencyPlan } from '@/lib/services/avRfService'
import { PERMISSIONS } from '@/lib/permissions'

export const POST = withAuth<unknown, { id: string }>(async ({ orgId, ctx, params }) => {
  await assertCanUseAV(ctx.userId, PERMISSIONS.AV_COORDINATE)
  return NextResponse.json(ok(await coordinateFrequencyPlan(orgId, params.id)))
})

