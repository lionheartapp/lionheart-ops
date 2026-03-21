import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateTeamMember, removeTeamMember } from '@/lib/services/eventTeamService'
import { UpdateEventTeamMemberSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/team/[memberId]' })

type RouteParams = {
  params: Promise<{ id: string; memberId: string }>
}

/**
 * PATCH /api/events/projects/[id]/team/[memberId]
 *
 * Updates a team member's role or notes.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = UpdateEventTeamMemberSchema.parse(body)
      const updated = await updateTeamMember(memberId, validated, ctx.userId, id)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to update team member')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/events/projects/[id]/team/[memberId]
 *
 * Removes a team member (hard delete).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    return await runWithOrgContext(orgId, async () => {
      await removeTeamMember(memberId, ctx.userId, id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to remove team member')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
