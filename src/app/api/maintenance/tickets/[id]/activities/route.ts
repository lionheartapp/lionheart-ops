/**
 * GET /api/maintenance/tickets/[id]/activities — list activities (respects internal filter)
 * POST /api/maintenance/tickets/[id]/activities — add comment or internal note
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { assertCan, canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const AddActivitySchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  isInternal: z.boolean().default(false),
})

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_OWN)

    const canSeeInternal = await canAny(ctx.userId, [
      PERMISSIONS.MAINTENANCE_READ_ALL,
      PERMISSIONS.MAINTENANCE_CLAIM,
    ])

    const activities = await runWithOrgContext(orgId, async () => {
      const all = await prisma.maintenanceTicketActivity.findMany({
        where: {
          ticketId: id,
          ...(canSeeInternal ? {} : { isInternal: false }),
        },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      return all
    })

    return NextResponse.json(ok(activities))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/tickets/[id]/activities]', error)
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
    const parsed = AddActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request'),
        { status: 400 }
      )
    }
    const { content, isInternal } = parsed.data

    // Only maintenance staff can create internal notes
    const canCreateInternal = await canAny(ctx.userId, [
      PERMISSIONS.MAINTENANCE_READ_ALL,
      PERMISSIONS.MAINTENANCE_CLAIM,
    ])
    const effectiveIsInternal = isInternal && canCreateInternal

    // Verify the ticket exists and belongs to org
    const ticket = await runWithOrgContext(orgId, () =>
      prisma.maintenanceTicket.findUnique({ where: { id }, select: { id: true } })
    )
    if (!ticket) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    const activity = await rawPrisma.maintenanceTicketActivity.create({
      data: {
        organizationId: orgId,
        ticketId: id,
        actorId: ctx.userId,
        type: effectiveIsInternal ? 'INTERNAL_NOTE' : 'COMMENT',
        content,
        isInternal: effectiveIsInternal,
      },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json(ok(activity), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/maintenance/tickets/[id]/activities]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
