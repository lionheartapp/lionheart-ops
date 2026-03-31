import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateEventDisposition } from '@/lib/services/itContentFilterService'

export const PUT = withAuth(async ({ orgId, ctx, params, req }) => {
  const body = await req.json()
  const { disposition, notes } = body as { disposition: string; notes?: string }

  if (!disposition || !['APPROVED', 'DENIED', 'ESCALATED'].includes(disposition)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'disposition must be APPROVED, DENIED, or ESCALATED'),
      { status: 400 }
    )
  }

  const updated = await updateEventDisposition(orgId, params.id, ctx.userId, { disposition, notes })
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_FILTERS_MANAGE })
