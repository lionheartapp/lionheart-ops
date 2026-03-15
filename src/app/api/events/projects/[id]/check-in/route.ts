/**
 * Event Check-In API — Collection Endpoint
 *
 * GET  /api/events/projects/[id]/check-in        — counter; ?full=true for full status list
 * POST /api/events/projects/[id]/check-in        — check in a participant (QR scan or manual)
 * PUT  /api/events/projects/[id]/check-in        — batch offline sync
 *
 * Requires: events:checkin:manage
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_CHECKIN_MANAGE)

    const url = new URL(req.url)
    const full = url.searchParams.get('full') === 'true'

    return await runWithOrgContext(orgId, async () => {
      const counter = await getCheckInCounter(eventProjectId)

      if (!full) {
        return NextResponse.json(ok(counter))
      }

      const statusList = await getCheckInStatus(eventProjectId)
      return NextResponse.json(ok({
        ...counter,
        participants: statusList,
      }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[check-in GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST — Check In a Participant ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_CHECKIN_MANAGE)

    const body = await req.json()
    const parsed = checkInBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const record = await checkIn({
        eventProjectId,
        registrationId: parsed.data.registrationId,
        checkedInById: ctx.userId,
        method: parsed.data.method,
      })

      return NextResponse.json(ok(record))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    if (error instanceof Error && error.message.includes('does not belong')) {
      return NextResponse.json(fail('BAD_REQUEST', error.message), { status: 400 })
    }
    console.error('[check-in POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PUT — Offline Sync ───────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params // consume params (not needed for sync — checkIns carry their own eventProjectId)
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_CHECKIN_MANAGE)

    const body = await req.json()
    const parsed = syncBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const result = await syncOfflineCheckIns(
        parsed.data.checkIns.map((ci) => ({
          registrationId: ci.registrationId,
          eventProjectId: ci.eventProjectId,
          checkedInAt: new Date(ci.checkedInAt),
          method: ci.method,
        })),
      )

      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[check-in PUT sync]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
