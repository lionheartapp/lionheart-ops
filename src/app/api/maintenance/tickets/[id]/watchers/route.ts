/**
 * GET  /api/maintenance/tickets/[id]/watchers — list watchers
 * POST /api/maintenance/tickets/[id]/watchers — add watcher
 * DELETE /api/maintenance/tickets/[id]/watchers — remove watcher
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_OWN)

    const watchers = await runWithOrgContext(orgId, () =>
      prisma.maintenanceTicketWatcher.findMany({
        where: { ticketId: id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
    )

    return NextResponse.json(ok(watchers))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/tickets/[id]/watchers]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_OWN)

    const body = await req.json()
    const userId = body.userId as string
    if (!userId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'userId is required'), { status: 400 })
    }

    const watcher = await runWithOrgContext(orgId, () =>
      prisma.maintenanceTicketWatcher.upsert({
        where: { ticketId_userId: { ticketId: id, userId } },
        create: { organizationId: orgId, ticketId: id, userId },
        update: {},
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
    )

    return NextResponse.json(ok(watcher), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/maintenance/tickets/[id]/watchers]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const userId = body.userId as string
    if (!userId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'userId is required'), { status: 400 })
    }

    // Can remove self, or need MAINTENANCE_MANAGE to remove others
    if (userId !== ctx.userId) {
      const canManage = await can(ctx.userId, PERMISSIONS.MAINTENANCE_ASSIGN)
      if (!canManage) {
        return NextResponse.json(fail('FORBIDDEN', 'Cannot remove other watchers'), { status: 403 })
      }
    }

    await runWithOrgContext(orgId, () =>
      prisma.maintenanceTicketWatcher.deleteMany({
        where: { ticketId: id, userId },
      })
    )

    return NextResponse.json(ok({ removed: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[DELETE /api/maintenance/tickets/[id]/watchers]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
