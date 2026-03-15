/**
 * Event Incidents API — Collection Endpoint
 *
 * GET /api/events/projects/[id]/incidents          — list incidents (filterable by type/severity)
 * POST /api/events/projects/[id]/incidents         — log a new incident
 * PUT  /api/events/projects/[id]/incidents         — batch offline sync
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_INCIDENTS_MANAGE)

    const url = new URL(req.url)
    const typeParam = url.searchParams.get('type')
    const severityParam = url.searchParams.get('severity')

    // Validate optional filter params
    const validTypes = Object.values(EventIncidentType)
    const validSeverities = Object.values(EventIncidentSeverity)

    const typeFilter = typeParam && validTypes.includes(typeParam as EventIncidentType)
      ? (typeParam as EventIncidentType)
      : undefined

    const severityFilter = severityParam && validSeverities.includes(severityParam as EventIncidentSeverity)
      ? (severityParam as EventIncidentSeverity)
      : undefined

    return await runWithOrgContext(orgId, async () => {
      const incidents = await listIncidents(eventProjectId, {
        type: typeFilter,
        severity: severityFilter,
      })

      return NextResponse.json(ok(incidents))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[incidents GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST — Log Incident ──────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_INCIDENTS_MANAGE)

    const body = await req.json()
    const parsed = incidentBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const incident = await createIncident({
        eventProjectId,
        organizationId: orgId,
        type: parsed.data.type,
        severity: parsed.data.severity,
        description: parsed.data.description,
        actionsTaken: parsed.data.actionsTaken,
        followUpNeeded: parsed.data.followUpNeeded,
        followUpNotes: parsed.data.followUpNotes,
        photoUrl: parsed.data.photoUrl,
        reportedById: ctx.userId,
        participantIds: parsed.data.participantIds,
      })

      return NextResponse.json(ok(incident), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[incidents POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PUT — Offline Sync ───────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params // consume params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_INCIDENTS_MANAGE)

    const body = await req.json()
    const parsed = syncBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Use the ctx.userId as the reportedById for incidents that don't specify it
      const result = await syncOfflineIncidents(
        parsed.data.incidents.map((inc) => ({
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
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[incidents PUT sync]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
