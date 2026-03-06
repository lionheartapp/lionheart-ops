/**
 * GET /api/maintenance/tickets — list tickets (role-scoped)
 * POST /api/maintenance/tickets — create a new maintenance ticket
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { createMaintenanceTicket, listTickets } from '@/lib/services/maintenanceTicketService'
import type {
  MaintenanceTicketStatus,
  MaintenanceCategory,
  MaintenancePriority,
} from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_SUBMIT)

    const body = await req.json()

    const ticket = await runWithOrgContext(orgId, () =>
      createMaintenanceTicket(body, ctx.userId, orgId)
    )

    return NextResponse.json(ok(ticket), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/maintenance/tickets]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_OWN)

    const url = new URL(req.url)
    const filters = {
      status: (url.searchParams.get('status') || undefined) as MaintenanceTicketStatus | undefined,
      priority: (url.searchParams.get('priority') || undefined) as MaintenancePriority | undefined,
      category: (url.searchParams.get('category') || undefined) as MaintenanceCategory | undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      assignedToId: url.searchParams.get('assignedToId') || undefined,
      search: url.searchParams.get('search') || undefined,
      unassigned: url.searchParams.get('unassigned') === 'true',
      excludeStatus: (url.searchParams.get('excludeStatus') || undefined) as MaintenanceTicketStatus | undefined,
    }

    const tickets = await runWithOrgContext(orgId, () =>
      listTickets(filters, { userId: ctx.userId, organizationId: orgId })
    )

    return NextResponse.json(ok(tickets))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/tickets]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
