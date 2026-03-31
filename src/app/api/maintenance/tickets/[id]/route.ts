/**
 * GET /api/maintenance/tickets/[id] — get ticket detail
 * PATCH /api/maintenance/tickets/[id] — update ticket metadata (add comment, assign, add photos)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { getTicketDetail, assignTicket } from '@/lib/services/maintenanceTicketService'

export const GET = withAuth(async ({ orgId, ctx, params, permissions }) => {
  const ticket = await getTicketDetail(params.id, ctx.userId)

  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }

  // If user only has READ_OWN and is not the submitter, deny
  const hasReadAll = await permissions.canAny([
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.MAINTENANCE_CLAIM,
  ])
  if (!hasReadAll && ticket.submittedById !== ctx.userId) {
    return NextResponse.json(fail('FORBIDDEN', 'Access denied'), { status: 403 })
  }

  return NextResponse.json(ok(ticket))
}, { permission: PERMISSIONS.MAINTENANCE_READ_OWN })

export const PATCH = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()
  const { assignedToId, photos, description, estimatedRepairCostUSD, ...rest } = body

  // If assigning, delegate to assignTicket (which checks MAINTENANCE_ASSIGN permission)
  if (assignedToId !== undefined) {
    const updated = await assignTicket(params.id, assignedToId, ctx.userId, orgId)
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
    const current = await prisma.maintenanceTicket.findUnique({
      where: { id: params.id },
      select: { photos: true, organizationId: true },
    })
    if (!current) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }
    updateData.photos = [...current.photos, ...photos]

    // Log PHOTO_ADDED activity
    await rawPrisma.maintenanceTicketActivity.create({
      data: {
        organizationId: orgId,
        ticketId: params.id,
        actorId: ctx.userId,
        type: 'PHOTO_ADDED',
        content: `${photos.length} photo(s) added`,
      },
    })
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'No valid fields to update'), { status: 400 })
  }

  const updated = await prisma.maintenanceTicket.update({
    where: { id: params.id },
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

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.MAINTENANCE_UPDATE_OWN })
