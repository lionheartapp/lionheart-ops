import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  updateScheduleBlock,
  deleteScheduleBlock,
} from '@/lib/services/eventProjectService'
import { UpdateScheduleBlockSchema } from '@/lib/types/event-project'

/**
 * PATCH /api/events/projects/[id]/schedule/[blockId]
 *
 * Updates a schedule block within an EventProject.
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const PATCH = withAuth(async ({ params, ctx, body }) => {
  const updated = await updateScheduleBlock(params.blockId, body, ctx.userId)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: UpdateScheduleBlockSchema })

/**
 * DELETE /api/events/projects/[id]/schedule/[blockId]
 *
 * Deletes a schedule block (hard delete — schedule blocks are not soft-deleted).
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const DELETE = withAuth(async ({ params, ctx }) => {
  await deleteScheduleBlock(params.blockId, ctx.userId, params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
