/**
 * Event Incidents API — Per-Incident Endpoint
 *
 * GET    /api/events/projects/[id]/incidents/[incidentId]  — fetch single incident
 * PUT    /api/events/projects/[id]/incidents/[incidentId]  — update incident details
 * DELETE /api/events/projects/[id]/incidents/[incidentId]  — delete incident
 *
 * Requires: events:incidents:manage
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
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

export const GET = withAuth(async ({ params }) => {
  const incident = await getIncident(params.incidentId)

  if (!incident) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  return NextResponse.json(ok(incident))
}, { permission: PERMISSIONS.EVENTS_INCIDENTS_MANAGE })

// ─── PUT — Update Incident ────────────────────────────────────────────────────

export const PUT = withAuth(async ({ params, body }) => {
  // Ensure at least one field is being updated
  if (Object.keys(body).length === 0) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'No fields provided for update'),
      { status: 400 },
    )
  }

  // Verify incident exists before updating
  const existing = await getIncident(params.incidentId)
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  const updated = await updateIncident(params.incidentId, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENTS_INCIDENTS_MANAGE, schema: updateIncidentSchema })

// ─── DELETE — Delete Incident ─────────────────────────────────────────────────

export const DELETE = withAuth(async ({ params }) => {
  // Verify incident exists before deleting
  const existing = await getIncident(params.incidentId)
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  await deleteIncident(params.incidentId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_INCIDENTS_MANAGE })
