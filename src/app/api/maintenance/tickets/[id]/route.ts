/**
 * GET /api/maintenance/tickets/[id] — get ticket detail
 * PATCH /api/maintenance/tickets/[id] — update ticket metadata (add comment, assign, add photos)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { assertCan, canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { getTicketDetail, assignTicket } from '@/lib/services/maintenanceTicketService'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_OWN)

    const ticket = await runWithOrgContext(orgId, () =>
      getTicketDetail(id, ctx.userId)
    )

    if (!ticket) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    // If user only has READ_OWN and is not the submitter, deny
    const hasReadAll = await canAny(ctx.userId, [
      PERMISSIONS.MAINTENANCE_READ_ALL,
      PERMISSIONS.MAINTENANCE_CLAIM,
    ])
    if (!hasReadAll && ticket.submittedById !== ctx.userId) {
      return NextResponse.json(fail('FORBIDDEN', 'Access denied'), { status: 403 })
    }

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/tickets/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_UPDATE_OWN)

    const body = await req.json()
    const { assignedToId, photos, description, estimatedRepairCostUSD, ...rest } = body

    // If assigning, delegate to assignTicket (which checks MAINTENANCE_ASSIGN permission)
    if (assignedToId !== undefined) {
      const updated = await runWithOrgContext(orgId, () =>
        assignTicket(id, assignedToId, ctx.userId, orgId)
      )
      return NextResponse.json(ok(updated))
    }

    // Otherwise do a metadata update (add photos, update description, estimated cost, etc.)
    const updateData: Record<string, unknown> = {}
    if (description !== undefined) updateData.description = description
    if (estimatedRepairCostUSD !== undefined) {
      updateData.estimatedRepairCostUSD =
        typeof estimatedRepairCostUSD === 'number' ? estimatedRepairCostUSD : null
    }

    // Append photos if provided
    if (photos && Array.isArray(photos) && photos.length > 0) {
      const current = await runWithOrgContext(orgId, async () => {
        return prisma.maintenanceTicket.findUnique({
          where: { id },
          select: { photos: true, organizationId: true },
        })
      })
      if (!current) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
      updateData.photos = [...current.photos, ...photos]

      // Log PHOTO_ADDED activity
      await rawPrisma.maintenanceTicketActivity.create({
        data: {
          organizationId: orgId,
          ticketId: id,
          actorId: ctx.userId,
          type: 'PHOTO_ADDED',
          content: `${photos.length} photo(s) added`,
        },
      })
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'No valid fields to update'), { status: 400 })
    }

    const updated = await runWithOrgContext(orgId, () =>
      prisma.maintenanceTicket.update({
        where: { id },
        data: updateData as any,
        include: {
          submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          building: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
          room: { select: { id: true, roomNumber: true, displayName: true } },
          school: { select: { id: true, name: true } },
        },
      })
    )

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'TICKET_NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }
    }
    console.error('[PATCH /api/maintenance/tickets/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
