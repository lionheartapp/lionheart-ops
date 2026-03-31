import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { updateEventTask } from '@/lib/services/eventProjectService'
import { UpdateEventTaskSchema } from '@/lib/types/event-project'

/**
 * PATCH /api/events/projects/[id]/tasks/[taskId]
 *
 * Updates a task within an EventProject.
 * Completing a task (status -> DONE) sets completedAt automatically.
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const PATCH = withAuth(async ({ params, ctx, body }) => {
  const updated = await updateEventTask(params.taskId, body, ctx.userId, params.id)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: UpdateEventTaskSchema })

/**
 * DELETE /api/events/projects/[id]/tasks/[taskId]
 *
 * Hard-deletes a task (tasks are not soft-deleted).
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const DELETE = withAuth(async ({ params }) => {
  const db = prisma as any
  // Hard delete — tasks are not soft-deleted
  await db.eventTask.delete({ where: { id: params.taskId } })
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
