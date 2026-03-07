/**
 * GET /api/it/tickets/:id — IT ticket detail
 * PATCH /api/it/tickets/:id — update IT ticket fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getITTicketDetail } from '@/lib/services/itTicketService'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_READ_OWN)
    const { id } = await params

    const ticket = await runWithOrgContext(orgId, () => getITTicketDetail(id))

    if (!ticket) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/tickets/:id]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_UPDATE_STATUS)
    const { id } = await params

    const body = await req.json()
    const allowedFields = ['title', 'description', 'issueType', 'passwordSubType', 'avSubType', 'priority', 'buildingId', 'areaId', 'roomId', 'schoolId']
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    const ticket = await runWithOrgContext(orgId, () =>
      prisma.iTTicket.update({
        where: { id },
        data: updateData,
        include: {
          submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          building: { select: { id: true, name: true } },
          room: { select: { id: true, roomNumber: true, displayName: true } },
        },
      })
    )

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[PATCH /api/it/tickets/:id]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
