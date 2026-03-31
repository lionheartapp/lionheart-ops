import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getActivityLog } from '@/lib/services/eventProjectService'

/**
 * GET /api/events/projects/[id]/activity
 *
 * Returns all activity log entries for an EventProject, newest first.
 * The activity log is an immutable append-only audit trail — entries
 * are never edited or deleted.
 */
export const GET = withAuth(async ({ params }) => {
  const entries = await getActivityLog(params.id)
  return NextResponse.json(ok(entries))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })
