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

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  type EventGroupType,
} from '@/lib/services/eventGroupService'

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

export const GET = withAuth(async ({ params, searchParams }) => {
  const eventProjectId = params.id
  const typeParam = searchParams.get('type')
  const groupType = typeParam && GROUP_TYPES.includes(typeParam as EventGroupType)
    ? (typeParam as EventGroupType)
    : undefined

  const groups = await listGroups(eventProjectId, groupType)
  return NextResponse.json(ok(groups))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE })

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ params, body }) => {
  const eventProjectId = params.id
  const group = await createGroup({ eventProjectId, ...body })
  return NextResponse.json(ok(group), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: createGroupSchema })

// ─── PUT ──────────────────────────────────────────────────────────────────────

export const PUT = withAuth(async ({ body }) => {
  const { groupId, ...updateData } = body
  const group = await updateGroup(groupId, updateData)
  return NextResponse.json(ok(group))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: updateGroupSchema })

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = withAuth(async ({ body }) => {
  await deleteGroup(body.groupId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: deleteGroupSchema })
