/**
 * GET /api/it/dashboard — IT Help Desk dashboard stats
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getITDashboardStats } from '@/lib/services/itTicketService'

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const schoolId = searchParams.get('schoolId') || undefined

  const stats = await getITDashboardStats({ userId: ctx.userId, orgId }, schoolId)

  return NextResponse.json(ok(stats))
}, { permission: PERMISSIONS.IT_TICKET_READ_OWN })
