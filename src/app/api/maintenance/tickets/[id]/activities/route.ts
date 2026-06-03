/**
 * GET /api/maintenance/tickets/[id]/activities — list activities (respects internal filter)
 * POST /api/maintenance/tickets/[id]/activities — add comment or internal note
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const AddActivitySchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  isInternal: z.boolean().default(false),
})

export const GET = withAuth(async ({ orgId, ctx, params, permissions }) => {
  const canSeeInternal = await permissions.canAny([
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.MAINTENANCE_CLAIM,
  ])

  const activities = await prisma.maintenanceTicketActivity.findMany({
    where: {
      ticketId: params.id,
      ...(canSeeInternal ? {} : { isInternal: false }),
    },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(ok(activities))
}, { permission: PERMISSIONS.MAINTENANCE_READ_OWN })

export const POST = withAuth(async ({ req, orgId, ctx, params, permissions }) => {
  const body = await req.json()
  const parsed = AddActivitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid request'),
      { status: 400 }
    )
  }
  const { content, isInternal } = parsed.data

  // Only maintenance staff can create internal notes
  const canCreateInternal = await permissions.canAny([
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.MAINTENANCE_CLAIM,
  ])
  const effectiveIsInternal = isInternal && canCreateInternal

  // Verify the ticket exists and belongs to org
  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!ticket) {
    return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
  }

  const activity = await prisma.maintenanceTicketActivity.create({
    data: {
      organizationId: orgId,
      ticketId: params.id,
      actorId: ctx.userId,
      type: effectiveIsInternal ? 'INTERNAL_NOTE' : 'COMMENT',
      content,
      isInternal: effectiveIsInternal,
    },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
  })

  return NextResponse.json(ok(activity), { status: 201 })
}, { permission: PERMISSIONS.MAINTENANCE_READ_OWN })
