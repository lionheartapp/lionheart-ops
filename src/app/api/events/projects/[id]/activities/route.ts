/**
 * Activities API for an EventProject.
 *
 * GET    /api/events/projects/[id]/activities — list activity options with signup counts
 * POST   /api/events/projects/[id]/activities — create activity option
 * PUT    /api/events/projects/[id]/activities — update activity option
 * DELETE /api/events/projects/[id]/activities — delete activity option
 *
 * Requires: events:groups:manage permission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '@/lib/services/eventGroupService'

const createActivitySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  locationText: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const updateActivitySchema = z.object({
  activityId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  locationText: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const deleteActivitySchema = z.object({
  activityId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withAuth(async ({ params }) => {
  const activities = await listActivities(params.id)
  return NextResponse.json(ok(activities))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE })

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ params, body }) => {
  const activity = await createActivity({
    eventProjectId: params.id,
    ...body,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
  })
  return NextResponse.json(ok(activity), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: createActivitySchema })

// ─── PUT ──────────────────────────────────────────────────────────────────────

export const PUT = withAuth(async ({ body }) => {
  const { activityId, ...updateData } = body

  const activity = await updateActivity(activityId, {
    ...updateData,
    scheduledAt: updateData.scheduledAt !== undefined
      ? (updateData.scheduledAt ? new Date(updateData.scheduledAt) : null)
      : undefined,
  })
  return NextResponse.json(ok(activity))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: updateActivitySchema })

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = withAuth(async ({ body }) => {
  await deleteActivity(body.activityId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: deleteActivitySchema })
