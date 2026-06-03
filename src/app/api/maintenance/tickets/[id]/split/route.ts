/**
 * POST /api/maintenance/tickets/[id]/split
 *
 * Creates a separate work order from an existing ticket while preserving
 * location context and leaving traceable activity on both tickets.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { splitMaintenanceTicket } from '@/lib/services/maintenanceTicketService'

export const POST = withAuth(async ({ req, ctx, orgId, params }) => {
  const body = await req.json()

  try {
    const ticket = await splitMaintenanceTicket(params.id, body, {
      userId: ctx.userId,
      organizationId: orgId,
    })

    return NextResponse.json(ok(ticket), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'SOURCE_TICKET_NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    throw error
  }
}, { permission: PERMISSIONS.MAINTENANCE_UPDATE_ALL })
