/**
 * Groups API for an EventProject.
 *
 * GET    /api/events/projects/[id]/groups         — list groups (optional ?type=BUS filter)
 * POST   /api/events/projects/[id]/groups         — create group
 * PUT    /api/events/projects/[id]/groups         — update group
 * DELETE /api/events/projects/[id]/groups         — delete group
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
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  type EventGroupType,
} from '@/lib/services/eventGroupService'

type RouteParams = { params: Promise<{ id: string }> }

const GROUP_TYPES: EventGroupType[] = ['BUS', 'CABIN', 'SMALL_GROUP', 'ACTIVITY']

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['BUS', 'CABIN', 'SMALL_GROUP', 'ACTIVITY']),
  capacity: z.number().int().positive().nullable().optional(),
  leaderId: z.string().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const updateGroupSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['BUS', 'CABIN', 'SMALL_GROUP', 'ACTIVITY']).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  leaderId: z.string().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const deleteGroupSchema = z.object({
  groupId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const url = new URL(req.url)
    const typeParam = url.searchParams.get('type')
    const groupType = typeParam && GROUP_TYPES.includes(typeParam as EventGroupType)
      ? (typeParam as EventGroupType)
      : undefined

    return await runWithOrgContext(orgId, async () => {
      const groups = await listGroups(eventProjectId, groupType)
      return NextResponse.json(ok(groups))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[groups GET]', error)
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
    const parsed = createGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const group = await createGroup({ eventProjectId, ...parsed.data })
      return NextResponse.json(ok(group), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[groups POST]', error)
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
    const parsed = updateGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const { groupId, ...updateData } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const group = await updateGroup(groupId, updateData)
      return NextResponse.json(ok(group))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[groups PUT]', error)
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
    const parsed = deleteGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      await deleteGroup(parsed.data.groupId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[groups DELETE]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
