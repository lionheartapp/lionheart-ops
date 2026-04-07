/**
 * POST /api/events/ai/detect-conflicts
 *
 * Deterministic conflict detection for an EventProject.
 * Checks room double-booking, staff scheduling conflicts, transportation overlap,
 * and audience overlap across all events in the organization.
 *
 * No AI required — pure database queries and logic.
 *
 * Body: { eventProjectId } or { startsAt, endsAt, buildingId?, roomId? }
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { detectConflicts } from '@/lib/services/ai/eventAIService'

const BodySchema = z.union([
  z.object({
    eventProjectId: z.string().min(1),
  }),
  z.object({
    eventProjectId: z.string().min(1).optional(),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    buildingId: z.string().optional(),
    roomId: z.string().optional(),
  }),
])

export const POST = withAuth(async ({ orgId, body }) => {
  const data = body

  let startsAt: string
  let endsAt: string
  let buildingId: string | undefined
  let roomId: string | undefined
  let eventProjectId: string

  if ('eventProjectId' in data && data.eventProjectId && !('startsAt' in data)) {
    // Load from event project
    const project = await (prisma as unknown as OrgPrismaClient).eventProject.findFirst({
      where: { id: data.eventProjectId },
      select: { id: true, startsAt: true, endsAt: true, buildingId: true, roomId: true },
    })

    if (!project) {
      return NextResponse.json(fail('NOT_FOUND', 'EventProject not found'), { status: 404 })
    }

    startsAt = project.startsAt.toISOString()
    endsAt = project.endsAt.toISOString()
    buildingId = project.buildingId ?? undefined
    roomId = project.roomId ?? undefined
    eventProjectId = project.id
  } else if ('startsAt' in data) {
    startsAt = data.startsAt
    endsAt = data.endsAt
    buildingId = ('buildingId' in data ? data.buildingId : undefined) ?? undefined
    roomId = ('roomId' in data ? data.roomId : undefined) ?? undefined
    eventProjectId = ('eventProjectId' in data ? data.eventProjectId : undefined) ?? 'new'
  } else {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Provide eventProjectId or startsAt/endsAt'),
      { status: 400 },
    )
  }

  const report = await detectConflicts({
    eventProjectId,
    startsAt,
    endsAt,
    buildingId,
    roomId,
    organizationId: orgId,
  })

  return NextResponse.json(ok(report))
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE, schema: BodySchema })
