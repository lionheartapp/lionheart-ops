import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { assertCanUseAV, getFrequencyPlan } from '@/lib/services/avRfService'

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, ctx, params }) => {
  await assertCanUseAV(ctx.userId)
  return NextResponse.json(ok(await getFrequencyPlan(orgId, params.id)))
})

