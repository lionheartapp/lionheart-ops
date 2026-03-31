/**
 * Event Incidents API — Collection Endpoint
 *
 * GET /api/events/projects/[id]/incidents          — list incidents (filterable by type/severity)
 * POST /api/events/projects/[id]/incidents         — log a new incident
 * PUT  /api/events/projects/[id]/incidents         — batch offline sync
 *
 * Requires: events:incidents:manage
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { EventIncidentType, EventIncidentSeverity } from '@prisma/client'
import {
  createIncident,
  listIncidents,
  syncOfflineIncidents,
} from '@/lib/services/eventIncidentService'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const incidentBodySchema = z.object({
  type: z.nativeEnum(EventIncidentType),
  severity: z.nativeEnum(EventIncidentSeverity),
  description: z.string().min(1, 'description is required'),
  actionsTaken: z.string().optional(),
  followUpNeeded: z.boolean().optional().default(false),
  followUpNotes: z.string().optional(),
  photoUrl: z.string().url().optional(),
  participantIds: z.array(z.string()).optional().default([]),
})

const singleSyncIncidentSchema = z.object({
  eventProjectId: z.string().min(1),
  organizationId: z.string().min(1),
  type: z.nativeEnum(EventIncidentType),
  severity: z.nativeEnum(EventIncidentSeverity),
  description: z.string().min(1),
  actionsTaken: z.string().optional(),
  followUpNeeded: z.boolean().optional().default(false),
  followUpNotes: z.string().optional(),
  photoUrl: z.string().url().optional(),
  reportedById: z.string().min(1),
  participantIds: z.array(z.string()).optional().default([]),
})

const syncBodySchema = z.object({
  incidents: z.array(singleSyncIncidentSchema).min(1, 'incidents array must not be empty'),
})

// ─── GET — List Incidents ─────────────────────────────────────────────────────

export const GET = withAuth(async ({ params, searchParams }) => {
  const eventProjectId = params.id

  const typeParam = searchParams.get('type')
  const severityParam = searchParams.get('severity')

  // Validate optional filter params
  const validTypes = Object.values(EventIncidentType)
  const validSeverities = Object.values(EventIncidentSeverity)

  const typeFilter = typeParam && validTypes.includes(typeParam as EventIncidentType)
    ? (typeParam as EventIncidentType)
    : undefined

  const severityFilter = severityParam && validSeverities.includes(severityParam as EventIncidentSeverity)
    ? (severityParam as EventIncidentSeverity)
    : undefined

  const incidents = await listIncidents(eventProjectId, {
    type: typeFilter,
    severity: severityFilter,
  })

  return NextResponse.json(ok(incidents))
}, { permission: PERMISSIONS.EVENTS_INCIDENTS_MANAGE })

// ─── POST — Log Incident ──────────────────────────────────────────────────────

export const POST = withAuth(async ({ params, orgId, ctx, body }) => {
  const eventProjectId = params.id

  const incident = await createIncident({
    eventProjectId,
    organizationId: orgId,
    type: body.type,
    severity: body.severity,
    description: body.description,
    actionsTaken: body.actionsTaken,
    followUpNeeded: body.followUpNeeded,
    followUpNotes: body.followUpNotes,
    photoUrl: body.photoUrl,
    reportedById: ctx.userId,
    participantIds: body.participantIds,
  })

  return NextResponse.json(ok(incident), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_INCIDENTS_MANAGE, schema: incidentBodySchema })

// ─── PUT — Offline Sync ───────────────────────────────────────────────────────

export const PUT = withAuth(async ({ body }) => {
  const result = await syncOfflineIncidents(
    body.incidents.map((inc) => ({
      eventProjectId: inc.eventProjectId,
      organizationId: inc.organizationId,
      type: inc.type,
      severity: inc.severity,
      description: inc.description,
      actionsTaken: inc.actionsTaken,
      followUpNeeded: inc.followUpNeeded ?? false,
      followUpNotes: inc.followUpNotes,
      photoUrl: inc.photoUrl,
      reportedById: inc.reportedById,
      participantIds: inc.participantIds ?? [],
    })),
  )

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.EVENTS_INCIDENTS_MANAGE, schema: syncBodySchema })
