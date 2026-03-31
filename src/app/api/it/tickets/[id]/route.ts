/**
 * GET /api/it/tickets/:id — IT ticket detail
 * PATCH /api/it/tickets/:id — update IT ticket fields
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getITTicketDetail } from '@/lib/services/itTicketService'
import { prisma } from '@/lib/db'

export const GET = withAuth(async ({ params }) => {
  const ticket = await getITTicketDetail(params.id)

  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.IT_TICKET_READ_OWN })

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const allowedFields = ['title', 'description', 'issueType', 'passwordSubType', 'avSubType', 'priority', 'buildingId', 'areaId', 'roomId', 'schoolId']
  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field]
  }

  const ticket = await prisma.iTTicket.update({
    where: { id: params.id },
    data: updateData,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.IT_TICKET_UPDATE_STATUS })
