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

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '@/lib/services/eventGroupService'

type RouteParams = { params: Promise<{ id: string }> }

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

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const activities = await listActivities(eventProjectId)
      return NextResponse.json(ok(activities))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activities GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = createActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const activity = await createActivity({
        eventProjectId,
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      })
      return NextResponse.json(ok(activity), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activities POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = updateActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const { activityId, ...updateData } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const activity = await updateActivity(activityId, {
        ...updateData,
        scheduledAt: updateData.scheduledAt !== undefined
          ? (updateData.scheduledAt ? new Date(updateData.scheduledAt) : null)
          : undefined,
      })
      return NextResponse.json(ok(activity))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activities PUT]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = deleteActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      await deleteActivity(parsed.data.activityId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activities DELETE]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
