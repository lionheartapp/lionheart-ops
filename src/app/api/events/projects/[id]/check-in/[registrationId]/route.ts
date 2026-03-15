/**
 * Event Check-In API — Per-Registration Endpoint
 *
 * GET    /api/events/projects/[id]/check-in/[registrationId]
 *        — Full participant info (with medical gating via events:medical:read)
 * DELETE /api/events/projects/[id]/check-in/[registrationId]
 *        — Undo check-in (staff error correction)
 *
 * Requires: events:checkin:manage
 * Medical data additionally gated by: events:medical:read
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, can } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getParticipantByRegistration,
  undoCheckIn,
} from '@/lib/services/eventCheckInService'

// ─── GET — Full Participant Info ──────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  try {
    const { id: eventProjectId, registrationId } = await params
    void eventProjectId // eventProjectId context — not needed by service but validates route nesting
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_CHECKIN_MANAGE)

    // Medical data gate — only include if caller has the additional permission
    const hasMedicalAccess = await can(ctx.userId, PERMISSIONS.EVENTS_MEDICAL_READ)

    return await runWithOrgContext(orgId, async () => {
      const participant = await getParticipantByRegistration(registrationId, hasMedicalAccess)

      if (!participant) {
        return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
      }

      return NextResponse.json(ok(participant))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[check-in/:registrationId GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE — Undo Check-In ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  try {
    const { id: eventProjectId, registrationId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_CHECKIN_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      await undoCheckIn(eventProjectId, registrationId)
      return NextResponse.json(ok({ undone: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[check-in/:registrationId DELETE]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
