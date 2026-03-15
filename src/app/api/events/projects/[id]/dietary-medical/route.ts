/**
 * Dietary and Medical Report API.
 *
 * GET /api/events/projects/[id]/dietary-medical
 *
 * Returns aggregated dietary needs and medical info across all registered
 * participants for the event project.
 *
 * FERPA gate: Requires events:medical:read permission (admin-only).
 * This is separate from events:groups:manage to protect sensitive data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { getDietaryMedicalReport } from '@/lib/services/eventGroupService'

type RouteParams = { params: Promise<{ id: string }> }

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    // FERPA gate: medical:read is admin-only
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_MEDICAL_READ)

    return await runWithOrgContext(orgId, async () => {
      const report = await getDietaryMedicalReport(eventProjectId)
      return NextResponse.json(ok(report))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[dietary-medical GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
