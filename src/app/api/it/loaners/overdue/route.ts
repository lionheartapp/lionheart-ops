/**
 * GET /api/it/loaners/overdue — overdue loaner checkouts
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getOverdue } from '@/lib/services/itLoanerService'

export const GET = withAuth(async () => {
  const overdue = await getOverdue()

  return NextResponse.json(ok(overdue))
}, { permission: PERMISSIONS.IT_LOANER_MANAGE })
