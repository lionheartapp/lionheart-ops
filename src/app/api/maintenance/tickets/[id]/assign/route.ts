/**
 * PATCH /api/maintenance/tickets/[id]/assign — reassign ticket
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { assignTicket } from '@/lib/services/maintenanceTicketService'

export const PATCH = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()
  const assignedToId = body.assignedToId as string
  if (!assignedToId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'assignedToId is required'), { status: 400 })
  }

  const updated = await assignTicket(params.id, assignedToId, ctx.userId, orgId)

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.MAINTENANCE_ASSIGN })
