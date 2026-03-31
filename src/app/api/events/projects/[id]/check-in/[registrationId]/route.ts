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

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getParticipantByRegistration,
  undoCheckIn,
} from '@/lib/services/eventCheckInService'

// ─── GET — Full Participant Info ──────────────────────────────────────────────

export const GET = withAuth(async ({ params, permissions }) => {
  const { registrationId } = params
  void params.id // eventProjectId context — not needed by service but validates route nesting

  // Medical data gate — only include if caller has the additional permission
  const hasMedicalAccess = await permissions.can(PERMISSIONS.EVENTS_MEDICAL_READ)

  const participant = await getParticipantByRegistration(registrationId, hasMedicalAccess)

  if (!participant) {
    return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
  }

  return NextResponse.json(ok(participant))
}, { permission: PERMISSIONS.EVENTS_CHECKIN_MANAGE })

// ─── DELETE — Undo Check-In ───────────────────────────────────────────────────

export const DELETE = withAuth(async ({ params }) => {
  const { id: eventProjectId, registrationId } = params

  await undoCheckIn(eventProjectId, registrationId)
  return NextResponse.json(ok({ undone: true }))
}, { permission: PERMISSIONS.EVENTS_CHECKIN_MANAGE })
