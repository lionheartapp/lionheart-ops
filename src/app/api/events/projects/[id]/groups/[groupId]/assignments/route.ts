/**
 * Group Assignments API.
 *
 * GET    /api/events/projects/[id]/groups/[groupId]/assignments — list assignments + unassigned participants
 * POST   /api/events/projects/[id]/groups/[groupId]/assignments — assign participant to group
 * DELETE /api/events/projects/[id]/groups/[groupId]/assignments — remove participant from group
 *
 * Requires: events:groups:manage permission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getGroupAssignments,
  assignToGroup,
  removeFromGroup,
  getUnassignedParticipants,
  type EventGroupType,
} from '@/lib/services/eventGroupService'
import { prisma } from '@/lib/db'

const assignSchema = z.object({
  registrationId: z.string().min(1),
})

const removeSchema = z.object({
  registrationId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withAuth(async ({ params }) => {
  const { id: eventProjectId, groupId } = params

  // Get the group to determine its type (needed for unassigned query)
  const db = prisma as any
  const group = await db.eventGroup.findUnique({
    where: { id: groupId },
    select: { type: true, capacity: true },
  })

  if (!group) {
    return NextResponse.json(fail('NOT_FOUND', 'Group not found'), { status: 404 })
  }

  const [assignments, unassigned] = await Promise.all([
    getGroupAssignments(groupId),
    getUnassignedParticipants(eventProjectId, group.type as EventGroupType),
  ])

  return NextResponse.json(ok({ assignments, unassigned, capacity: group.capacity }))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE })

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ params, ctx, body }) => {
  const { groupId } = params

  try {
    const assignment = await assignToGroup(
      body.registrationId,
      groupId,
      ctx.userId,
    )
    return NextResponse.json(ok(assignment), { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Group is at capacity') {
      return NextResponse.json(
        fail('CAPACITY_FULL', 'Group is at capacity'),
        { status: 409 },
      )
    }
    throw err
  }
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: assignSchema })

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = withAuth(async ({ params, body }) => {
  const { groupId } = params

  await removeFromGroup(body.registrationId, groupId)
  return NextResponse.json(ok({ removed: true }))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: removeSchema })
