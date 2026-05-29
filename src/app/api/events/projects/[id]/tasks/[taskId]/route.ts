import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { can } from '@/lib/auth/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { findTaskIfAssignee } from '@/lib/services/eventProject-schedule'
import { updateEventTask } from '@/lib/services/eventProjectService'
import { UpdateEventTaskSchema } from '@/lib/types/event-project'

/**
 * PATCH /api/events/projects/[id]/tasks/[taskId]
 *
 * Two access tiers:
 *  - Users with EVENT_PROJECT_UPDATE_ALL can update any field on any task.
 *  - The current assignee on the task can update their own status (and only
 *    status) without team membership. This makes "My Tasks" actionable for
 *    people who were assigned a single task but aren't on the event team.
 *
 * Completing a task (status -> DONE) sets completedAt automatically inside
 * updateEventTask().
 */
// @authOnly Full task edits require event-project update permission; assigned users may update only their own task status.
export const PATCH = withAuth(async ({ params, ctx, body }) => {
  const hasFullAccess = await can(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

  if (!hasFullAccess) {
    // Fall back: allow the assignee to act on their own task, status only.
    const task = await findTaskIfAssignee(params.taskId, ctx.userId)
    if (!task) {
      return NextResponse.json(
        fail('FORBIDDEN', 'You do not have permission to update this task'),
        { status: 403 },
      )
    }

    const allowed = onlyStatusFields(body)
    if (!allowed) {
      return NextResponse.json(
        fail(
          'FORBIDDEN',
          'You can only update the status of tasks assigned to you',
        ),
        { status: 403 },
      )
    }

    const updated = await updateEventTask(params.taskId, allowed, ctx.userId, params.id)
    return NextResponse.json(ok(updated))
  }

  const updated = await updateEventTask(params.taskId, body, ctx.userId, params.id)
  return NextResponse.json(ok(updated))
}, { schema: UpdateEventTaskSchema })

/**
 * Returns the body if it contains only fields the assignee is allowed to
 * change (currently just `status`). Returns null if any other field is
 * present — caller should treat that as forbidden.
 */
function onlyStatusFields(
  body: unknown,
): { status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' } | null {
  if (!body || typeof body !== 'object') return null
  const keys = Object.keys(body)
  if (keys.length === 0) return null
  const allowed = new Set(['status'])
  if (keys.some((k) => !allowed.has(k))) return null

  const status = (body as Record<string, unknown>).status
  if (
    status !== 'TODO' &&
    status !== 'IN_PROGRESS' &&
    status !== 'BLOCKED' &&
    status !== 'DONE'
  ) {
    return null
  }
  return { status }
}

/**
 * DELETE /api/events/projects/[id]/tasks/[taskId]
 *
 * Hard-deletes a task (tasks are not soft-deleted).
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const DELETE = withAuth(async ({ params }) => {
  const db = prisma as unknown as OrgPrismaClient
  await db.eventTask.delete({ where: { id: params.taskId } })
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
