import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listPendingGateApprovals,
  countPendingGateApprovals,
} from '@/lib/services/eventProjectService'
import type { GateType } from '@/lib/services/eventProjectService'

const VALID_GATE_TYPES = new Set<GateType>(['admin', 'facilities', 'av', 'custodial', 'security', 'athletic_director'])

/**
 * GET /api/events/projects/pending-gates?gateType=av|facilities|admin&countOnly=true
 *
 * Returns EventProjects with a PENDING gate for the specified type.
 * Used by team-specific approval queues (AV -> av, Maintenance -> facilities).
 *
 * Query params:
 * - gateType (required): 'av' | 'facilities' | 'admin'
 * - countOnly (optional): if 'true', returns just { count: number }
 */
export const GET = withAuth(async ({ searchParams }) => {
  const gateType = searchParams.get('gateType') as GateType | null
  const countOnly = searchParams.get('countOnly') === 'true'

  if (!gateType || !VALID_GATE_TYPES.has(gateType)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'gateType query parameter is required and must be one of: admin, facilities, av, custodial, security, athletic_director'),
      { status: 400 },
    )
  }

  if (countOnly) {
    const count = await countPendingGateApprovals(gateType)
    return NextResponse.json(ok({ count }))
  }

  const projects = await listPendingGateApprovals(gateType)
  return NextResponse.json(ok(projects))
}, { permission: PERMISSIONS.EVENT_PROJECT_APPROVE })
