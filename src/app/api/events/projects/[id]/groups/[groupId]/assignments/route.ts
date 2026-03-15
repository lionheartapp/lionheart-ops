/**
 * Group Assignments API.
 *
 * GET    /api/events/projects/[id]/groups/[groupId]/assignments — list assignments + unassigned participants
 * POST   /api/events/projects/[id]/groups/[groupId]/assignments — assign participant to group
 * DELETE /api/events/projects/[id]/groups/[groupId]/assignments — remove participant from group
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
  getGroupAssignments,
  assignToGroup,
  removeFromGroup,
  getUnassignedParticipants,
  type EventGroupType,
} from '@/lib/services/eventGroupService'
import { prisma } from '@/lib/db'

type RouteParams = { params: Promise<{ id: string; groupId: string }> }

const assignSchema = z.object({
  registrationId: z.string().min(1),
})

const removeSchema = z.object({
  registrationId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId, groupId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
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
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[assignments GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId, groupId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      try {
        const assignment = await assignToGroup(
          parsed.data.registrationId,
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
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[assignments POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId, groupId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = removeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      await removeFromGroup(parsed.data.registrationId, groupId)
      return NextResponse.json(ok({ removed: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[assignments DELETE]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
