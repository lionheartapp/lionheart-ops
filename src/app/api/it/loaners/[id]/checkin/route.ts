/**
 * POST /api/it/loaners/[id]/checkin — checkin a loaner device
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { checkin } from '@/lib/services/itLoanerService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_LOANER_CHECKIN)

    const result = await runWithOrgContext(orgId, () =>
      checkin(id, ctx.userId)
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.includes('not found') || error.message.includes('already returned')) {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
    }
    console.error('[POST /api/it/loaners/[id]/checkin]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
