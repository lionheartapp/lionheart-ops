import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertCanUseAV, exportPlanCsv } from '@/lib/services/avRfService'

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, ctx, params }) => {
  await assertCanUseAV(ctx.userId)
  const csv = await exportPlanCsv(orgId, params.id)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rf-plan-${params.id}.csv"`,
    },
  })
})

