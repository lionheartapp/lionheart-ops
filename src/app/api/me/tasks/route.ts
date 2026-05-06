import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { getTasksForAssignee } from '@/lib/services/eventProject-schedule'

/**
 * GET /api/me/tasks
 *
 * Returns all tasks across all events in the org where the current user is
 * the assignee. Used by the My Tasks inbox so users outside an event team
 * can still see and complete tasks assigned to them.
 *
 * Optional query: ?status=TODO|IN_PROGRESS|DONE
 *
 * No special permission required beyond being authenticated — the result is
 * filtered to the caller's own assigneeId.
 */
export const GET = withAuth(async ({ ctx, searchParams }) => {
  const status = searchParams.get('status') ?? undefined
  const tasks = await getTasksForAssignee(ctx.userId, { status })
  return NextResponse.json(ok(tasks))
})
