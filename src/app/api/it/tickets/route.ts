/**
 * GET /api/it/tickets — list IT tickets (role-scoped)
 * POST /api/it/tickets — create a new IT ticket
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createITTicket,
  listITTickets,
  CreateITTicketSchema,
} from '@/lib/services/itTicketService'
import { notifyITTicketSubmitted, notifyITUrgentTicket } from '@/lib/services/itNotificationService'
import type { ITTicketStatus, ITIssueType, ITPriority } from '@prisma/client'

export const POST = withAuth(async ({ ctx, orgId, body }) => {
  const ticket = await createITTicket(body, ctx.userId, orgId)

  // Fire-and-forget notifications
  notifyITTicketSubmitted(ticket, orgId)
  if (body.priority === 'URGENT') {
    notifyITUrgentTicket(ticket, orgId)
  }

  return NextResponse.json(ok(ticket), { status: 201 })
}, { permission: PERMISSIONS.IT_TICKET_SUBMIT, schema: CreateITTicketSchema })

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const filters = {
    status: (searchParams.get('status') || undefined) as ITTicketStatus | undefined,
    issueType: (searchParams.get('issueType') || undefined) as ITIssueType | undefined,
    priority: (searchParams.get('priority') || undefined) as ITPriority | undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    assignedToId: searchParams.get('assignedToId') || undefined,
    search: searchParams.get('search') || undefined,
    unassigned: searchParams.get('unassigned') === 'true',
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  }

  const result = await listITTickets(filters, { userId: ctx.userId, orgId })

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_TICKET_READ_OWN })
