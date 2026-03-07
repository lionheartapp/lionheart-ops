/**
 * GET /api/it/board — Kanban board data for IT tickets
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getITBoardData } from '@/lib/services/itTicketService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_READ_OWN)

    const url = new URL(req.url)
    const schoolId = url.searchParams.get('schoolId') || undefined

    const board = await runWithOrgContext(orgId, () =>
      getITBoardData({ userId: ctx.userId, orgId }, schoolId)
    )

    return NextResponse.json(ok(board))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/board]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
