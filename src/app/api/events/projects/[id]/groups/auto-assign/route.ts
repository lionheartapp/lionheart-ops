/**
 * Auto-assign API for event groups.
 *
 * POST /api/events/projects/[id]/groups/auto-assign
 *
 * Distributes unassigned participants into groups of the specified type
 * using a round-robin algorithm with optional grade balancing.
 *
 * Requires: events:groups:manage permission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { autoAssign } from '@/lib/services/eventGroupService'

const autoAssignSchema = z.object({
  groupType: z.enum(['BUS', 'CABIN', 'SMALL_GROUP', 'ACTIVITY']),
  balanceBy: z.enum(['grade', 'gender']).optional(),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ params, body }) => {
  const eventProjectId = params.id

  try {
    const result = await autoAssign(eventProjectId, body.groupType, {
      balanceBy: body.balanceBy,
    })
    return NextResponse.json(ok(result))
  } catch (err) {
    if (err instanceof Error && err.message.includes('at capacity')) {
      return NextResponse.json(
        fail('CAPACITY_FULL', err.message),
        { status: 409 },
      )
    }
    if (err instanceof Error && err.message.includes('No groups of this type')) {
      return NextResponse.json(
        fail('NO_GROUPS', err.message),
        { status: 422 },
      )
    }
    throw err
  }
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: autoAssignSchema })
