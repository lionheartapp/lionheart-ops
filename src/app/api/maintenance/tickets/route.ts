/**
 * GET /api/maintenance/tickets — list tickets (role-scoped)
 * POST /api/maintenance/tickets — create a new maintenance ticket
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { createMaintenanceTicket, listTickets } from '@/lib/services/maintenanceTicketService'
import type {
  MaintenanceTicketStatus,
  MaintenanceCategory,
  MaintenancePriority,
} from '@prisma/client'

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const body = await req.json()

  const ticket = await createMaintenanceTicket(body, ctx.userId, orgId)

  return NextResponse.json(ok(ticket), { status: 201 })
}, { permission: PERMISSIONS.MAINTENANCE_SUBMIT })

export const GET = withAuth(async ({ orgId, ctx, searchParams }) => {
  const filters = {
    status: (searchParams.get('status') || undefined) as MaintenanceTicketStatus | undefined,
    priority: (searchParams.get('priority') || undefined) as MaintenancePriority | undefined,
    category: (searchParams.get('category') || undefined) as MaintenanceCategory | undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    assignedToId: searchParams.get('assignedToId') || undefined,
    search: searchParams.get('search') || undefined,
    unassigned: searchParams.get('unassigned') === 'true',
    excludeStatus: (searchParams.get('excludeStatus') || undefined) as MaintenanceTicketStatus | undefined,
  }

  const tickets = await listTickets(filters, { userId: ctx.userId, organizationId: orgId })

  return NextResponse.json(ok(tickets))
}, { permission: PERMISSIONS.MAINTENANCE_READ_OWN })
