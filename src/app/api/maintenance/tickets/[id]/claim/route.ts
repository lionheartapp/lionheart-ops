/**
 * POST /api/maintenance/tickets/[id]/claim — technician self-claim
 *
 * Guards:
 * - Must have MAINTENANCE_CLAIM permission
 * - Must have a TechnicianProfile
 * - Ticket specialty must match tech's specialties (or be OTHER)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { claimTicket } from '@/lib/services/maintenanceTicketService'

export const POST = withAuth(async ({ orgId, ctx, params }) => {
  try {
    const updated = await claimTicket(params.id, ctx.userId, orgId)
    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TECHNICIAN_PROFILE_NOT_FOUND') {
        return NextResponse.json(
          fail('BAD_REQUEST', 'Technician profile not found. Contact your administrator.'),
          { status: 400 }
        )
      }
      if (error.message === 'SPECIALTY_MISMATCH') {
        return NextResponse.json(
          fail('FORBIDDEN', 'This ticket requires a specialty not in your profile'),
          { status: 403 }
        )
      }
    }
    throw error
  }
})
