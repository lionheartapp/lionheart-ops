import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listPendingGateApprovals,
  countPendingGateApprovals,
} from '@/lib/services/eventProjectService'
import type { GateType } from '@/lib/services/eventProjectService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/pending-gates' })

const VALID_GATE_TYPES = new Set<GateType>(['av', 'facilities', 'admin'])

/**
 * GET /api/events/projects/pending-gates?gateType=av|facilities|admin&countOnly=true
 *
 * Returns EventProjects with a PENDING gate for the specified type.
 * Used by team-specific approval queues (AV → av, Maintenance → facilities).
 *
 * Query params:
 * - gateType (required): 'av' | 'facilities' | 'admin'
 * - countOnly (optional): if 'true', returns just { count: number }
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_APPROVE)

    const { searchParams } = new URL(req.url)
    const gateType = searchParams.get('gateType') as GateType | null
    const countOnly = searchParams.get('countOnly') === 'true'

    if (!gateType || !VALID_GATE_TYPES.has(gateType)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'gateType query parameter is required and must be av, facilities, or admin'),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      if (countOnly) {
        const count = await countPendingGateApprovals(gateType)
        return NextResponse.json(ok({ count }))
      }

      const projects = await listPendingGateApprovals(gateType)
      return NextResponse.json(ok(projects))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to fetch pending gate approvals')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
