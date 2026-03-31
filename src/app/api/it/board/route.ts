/**
 * GET /api/it/board — Kanban board data for IT tickets
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getITBoardData } from '@/lib/services/itTicketService'

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const schoolId = searchParams.get('schoolId') || undefined

  const board = await getITBoardData({ userId: ctx.userId, orgId }, schoolId)

  return NextResponse.json(ok(board))
}, { permission: PERMISSIONS.IT_TICKET_READ_OWN })
