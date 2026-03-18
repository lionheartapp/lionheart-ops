import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { resubmitForApproval } from '@/lib/services/eventProjectService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/resubmit' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/events/projects/[id]/resubmit
 *
 * Resubmits a DRAFT EventProject after revision following a rejection.
 * Resets rejected gates back to PENDING and transitions to PENDING_APPROVAL.
 * Only the event creator can resubmit.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_CREATE)

    return await runWithOrgContext(orgId, async () => {
      const result = await resubmitForApproval(id, ctx.userId)
      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    if (error instanceof Error && (
      error.message.includes('Cannot resubmit') ||
      error.message.includes('Only the creator') ||
      error.message.includes('No approval gates')
    )) {
      return NextResponse.json(fail('INVALID_STATE', error.message), { status: 400 })
    }
    log.error({ err: error }, 'Failed to resubmit EventProject')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
