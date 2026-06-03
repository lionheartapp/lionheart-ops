import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { assertCanUseAV, getAvDashboard } from '@/lib/services/avRfService'

export const GET = withAuth(async ({ orgId, ctx }) => {
  await assertCanUseAV(ctx.userId)
  return NextResponse.json(ok(await getAvDashboard(orgId)))
})

