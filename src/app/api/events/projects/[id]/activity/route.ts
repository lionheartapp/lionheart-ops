import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getActivityLog } from '@/lib/services/eventProjectService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/activity' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/projects/[id]/activity
 *
 * Returns all activity log entries for an EventProject, newest first.
 * The activity log is an immutable append-only audit trail — entries
 * are never edited or deleted.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      const entries = await getActivityLog(id)
      return NextResponse.json(ok(entries))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to fetch EventProject activity log')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
