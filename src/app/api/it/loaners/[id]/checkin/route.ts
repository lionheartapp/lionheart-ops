/**
 * POST /api/it/loaners/[id]/checkin — checkin a loaner device
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { checkin } from '@/lib/services/itLoanerService'

export const POST = withAuth(async ({ ctx, params }) => {
  const result = await checkin(params.id, ctx.userId)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_LOANER_CHECKIN })
