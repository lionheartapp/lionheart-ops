import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateEventTask } from '@/lib/services/eventProjectService'
import { UpdateEventTaskSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/tasks/[taskId]' })

type RouteParams = {
  params: Promise<{ id: string; taskId: string }>
}

/**
 * PATCH /api/events/projects/[id]/tasks/[taskId]
 *
 * Updates a task within an EventProject.
 * Completing a task (status → DONE) sets completedAt automatically.
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, taskId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = UpdateEventTaskSchema.parse(body)
      const updated = await updateEventTask(taskId, validated, ctx.userId, id)
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
    log.error({ err: error }, 'Failed to update task')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/events/projects/[id]/tasks/[taskId]
 *
 * Hard-deletes a task (tasks are not soft-deleted).
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _id, taskId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any
      // Hard delete — tasks are not soft-deleted
      await db.eventTask.delete({ where: { id: taskId } })
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to delete task')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
