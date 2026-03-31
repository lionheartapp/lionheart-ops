/**
 * GET  /api/maintenance/tickets/[id]/watchers — list watchers
 * POST /api/maintenance/tickets/[id]/watchers — add watcher
 * DELETE /api/maintenance/tickets/[id]/watchers — remove watcher
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

export const GET = withAuth(async ({ orgId, params }) => {
  const watchers = await prisma.maintenanceTicketWatcher.findMany({
    where: { ticketId: params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(ok(watchers))
}, { permission: PERMISSIONS.MAINTENANCE_READ_OWN })

export const POST = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()
  const userId = body.userId as string
  if (!userId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'userId is required'), { status: 400 })
  }

  const watcher = await prisma.maintenanceTicketWatcher.upsert({
    where: { ticketId_userId: { ticketId: params.id, userId } },
    create: { organizationId: orgId, ticketId: params.id, userId },
    update: {},
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  return NextResponse.json(ok(watcher), { status: 201 })
}, { permission: PERMISSIONS.MAINTENANCE_READ_OWN })

export const DELETE = withAuth(async ({ req, ctx, params, permissions }) => {
  const body = await req.json()
  const userId = body.userId as string
  if (!userId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'userId is required'), { status: 400 })
  }

  // Can remove self, or need MAINTENANCE_MANAGE to remove others
  if (userId !== ctx.userId) {
    const canManage = await permissions.can(PERMISSIONS.MAINTENANCE_ASSIGN)
    if (!canManage) {
      return NextResponse.json(fail('FORBIDDEN', 'Cannot remove other watchers'), { status: 403 })
    }
  }

  await prisma.maintenanceTicketWatcher.deleteMany({
    where: { ticketId: params.id, userId },
  })

  return NextResponse.json(ok({ removed: true }))
})
