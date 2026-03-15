/**
 * Event Incidents API — Per-Incident Endpoint
 *
 * GET    /api/events/projects/[id]/incidents/[incidentId]  — fetch single incident
 * PUT    /api/events/projects/[id]/incidents/[incidentId]  — update incident details
 * DELETE /api/events/projects/[id]/incidents/[incidentId]  — delete incident
 *
 * Requires: events:incidents:manage
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { EventIncidentSeverity } from '@prisma/client'
import {
  getIncident,
  updateIncident,
  deleteIncident,
} from '@/lib/services/eventIncidentService'

// ─── Schema ───────────────────────────────────────────────────────────────────

const updateIncidentSchema = z.object({
  description: z.string().min(1).optional(),
  actionsTaken: z.string().optional(),
  followUpNeeded: z.boolean().optional(),
  followUpNotes: z.string().optional(),
  severity: z.nativeEnum(EventIncidentSeverity).optional(),
  photoUrl: z.string().url().optional(),
})

// ─── GET — Single Incident ────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { incidentId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_INCIDENTS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const incident = await getIncident(incidentId)

      if (!incident) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      return NextResponse.json(ok(incident))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[incidents/:incidentId GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PUT — Update Incident ────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { incidentId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_INCIDENTS_MANAGE)

    const body = await req.json()
    const parsed = updateIncidentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    // Ensure at least one field is being updated
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'No fields provided for update'),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Verify incident exists before updating
      const existing = await getIncident(incidentId)
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      const updated = await updateIncident(incidentId, parsed.data)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[incidents/:incidentId PUT]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE — Delete Incident ─────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { incidentId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_INCIDENTS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      // Verify incident exists before deleting
      const existing = await getIncident(incidentId)
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      await deleteIncident(incidentId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[incidents/:incidentId DELETE]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
