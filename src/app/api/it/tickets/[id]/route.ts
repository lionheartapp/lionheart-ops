/**
 * GET /api/it/tickets/:id — IT ticket detail
 * PATCH /api/it/tickets/:id — update IT ticket fields
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getITTicketDetail } from '@/lib/services/itTicketService'
import { prisma } from '@/lib/db'

const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  issueType: z.enum(['HARDWARE', 'SOFTWARE', 'ACCOUNT_PASSWORD', 'NETWORK', 'DISPLAY_AV', 'OTHER']).optional(),
  passwordSubType: z.enum(['RESET', 'LOCKED', 'NEW_ACCOUNT', 'PERMISSION_CHANGE']).nullish(),
  avSubType: z.enum(['PROJECTOR', 'SOUNDBOARD', 'DISPLAY', 'APPLE_TV', 'OTHER_AV']).nullish(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  buildingId: z.string().uuid().nullish(),
  spaceId: z.string().uuid().nullish(),
  /** @deprecated Phase 1b — use spaceId */
  areaId: z.string().uuid().nullish(),
  roomId: z.string().uuid().nullish(),
  schoolId: z.string().uuid().nullish(),
})

export const GET = withAuth(async ({ params }) => {
  const ticket = await getITTicketDetail(params.id)

  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }

  // Fetch latest routing assignment log
  const assignmentLog = await prisma.ticketAssignmentLog.findFirst({
    where: { ticketId: params.id, module: 'IT' },
    orderBy: { createdAt: 'desc' },
    select: { reason: true, strategy: true, source: true, createdAt: true },
  })

  return NextResponse.json(ok({ ...ticket, assignmentLog }))
}, { permission: PERMISSIONS.IT_TICKET_READ_OWN })

export const PATCH = withAuth(async ({ body, params }) => {
  const ticket = await prisma.iTTicket.update({
    where: { id: params.id },
    data: body,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.IT_TICKET_UPDATE_STATUS, schema: UpdateTicketSchema })
