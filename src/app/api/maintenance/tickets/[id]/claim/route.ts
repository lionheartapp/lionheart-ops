/**
 * POST /api/maintenance/tickets/[id]/claim — technician self-claim
 *
 * Guards:
 * - Must have MAINTENANCE_CLAIM permission
 * - Must have a TechnicianProfile
 * - Ticket specialty must match tech's specialties (or be OTHER)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { claimTicket } from '@/lib/services/maintenanceTicketService'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const updated = await runWithOrgContext(orgId, () =>
      claimTicket(id, ctx.userId, orgId)
    )

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
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
      if (error.message === 'TICKET_NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
    }
    console.error('[POST /api/maintenance/tickets/[id]/claim]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
