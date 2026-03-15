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

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { autoAssign } from '@/lib/services/eventGroupService'

type RouteParams = { params: Promise<{ id: string }> }

const autoAssignSchema = z.object({
  groupType: z.enum(['BUS', 'CABIN', 'SMALL_GROUP', 'ACTIVITY']),
  balanceBy: z.enum(['grade', 'gender']).optional(),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = autoAssignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      try {
        const result = await autoAssign(eventProjectId, parsed.data.groupType, {
          balanceBy: parsed.data.balanceBy,
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
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[auto-assign POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
