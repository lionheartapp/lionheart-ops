/**
 * GET /api/it/tickets/:id/comments — list ticket activities
 * POST /api/it/tickets/:id/comments — add comment
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { addITTicketComment } from '@/lib/services/itTicketService'
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

    const canSeeInternal = await can(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_INTERNAL)

    const activities = await runWithOrgContext(orgId, () =>
      prisma.iTTicketActivity.findMany({
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
    )

    return NextResponse.json(ok(activities))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/tickets/:id/comments]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params
    const body = await req.json()

    const { content, isInternal } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'content is required'), { status: 400 })
    }

    // Check permission based on comment type
    if (isInternal) {
      await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_INTERNAL)
    } else {
      await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER)
    }

    const activity = await runWithOrgContext(orgId, () =>
      addITTicketComment(id, content.trim(), !!isInternal, { userId: ctx.userId })
    )

    return NextResponse.json(ok(activity), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/it/tickets/:id/comments]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
