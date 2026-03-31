/**
 * Event Check-In API — Collection Endpoint
 *
 * GET  /api/events/projects/[id]/check-in        — counter; ?full=true for full status list
 * POST /api/events/projects/[id]/check-in        — check in a participant (QR scan or manual)
 * PUT  /api/events/projects/[id]/check-in        — batch offline sync
 *
 * Requires: events:checkin:manage
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  checkIn,
  getCheckInCounter,
  getCheckInStatus,
  syncOfflineCheckIns,
} from '@/lib/services/eventCheckInService'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const checkInBodySchema = z.object({
  registrationId: z.string().min(1, 'registrationId is required'),
  method: z.enum(['QR_SCAN', 'MANUAL']).optional().default('QR_SCAN'),
})

const syncBodySchema = z.object({
  checkIns: z.array(
    z.object({
      registrationId: z.string().min(1),
      eventProjectId: z.string().min(1),
      checkedInAt: z.string().datetime(),
      method: z.enum(['QR_SCAN', 'MANUAL']).optional(),
    }),
  ).min(1, 'checkIns array must not be empty'),
})

// ─── GET — Counter (and optionally full status list) ─────────────────────────

export const GET = withAuth(async ({ params, searchParams }) => {
  const eventProjectId = params.id
  const full = searchParams.get('full') === 'true'

  const counter = await getCheckInCounter(eventProjectId)

  if (!full) {
    return NextResponse.json(ok(counter))
  }

  const statusList = await getCheckInStatus(eventProjectId)
  return NextResponse.json(ok({
    ...counter,
    participants: statusList,
  }))
}, { permission: PERMISSIONS.EVENTS_CHECKIN_MANAGE })

// ─── POST — Check In a Participant ───────────────────────────────────────────

export const POST = withAuth(async ({ params, ctx, body }) => {
  const eventProjectId = params.id

  try {
    const record = await checkIn({
      eventProjectId,
      registrationId: body.registrationId,
      checkedInById: ctx.userId,
      method: body.method,
    })

    return NextResponse.json(ok(record))
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not belong')) {
      return NextResponse.json(fail('BAD_REQUEST', error.message), { status: 400 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENTS_CHECKIN_MANAGE, schema: checkInBodySchema })

// ─── PUT — Offline Sync ───────────────────────────────────────────────────────

export const PUT = withAuth(async ({ body }) => {
  const result = await syncOfflineCheckIns(
    body.checkIns.map((ci) => ({
      registrationId: ci.registrationId,
      eventProjectId: ci.eventProjectId,
      checkedInAt: new Date(ci.checkedInAt),
      method: ci.method,
    })),
  )

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.EVENTS_CHECKIN_MANAGE, schema: syncBodySchema })
