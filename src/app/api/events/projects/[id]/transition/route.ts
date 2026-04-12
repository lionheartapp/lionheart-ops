import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { transitionEventProject } from '@/lib/services/eventProjectService'
import { z } from 'zod'

/**
 * POST /api/events/projects/[id]/transition
 *
 * Safe status transitions for the kanban board. Allowlist enforced inside
 * `transitionEventProject`. Approvals (→ CONFIRMED from PENDING_APPROVAL)
 * are NOT handled here — those must go through /approve-gate and the
 * Review Approval drawer.
 */

const TransitionSchema = z.object({
  toStatus: z.enum([
    'DRAFT',
    'PENDING_APPROVAL',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ]),
})

export const POST = withAuth(
  async ({ ctx, params, body }) => {
    try {
      const updated = await transitionEventProject(params.id, body.toStatus, ctx.userId)
      return NextResponse.json(ok(updated))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to transition event'
      // Transition-not-allowed errors map to 409 Conflict, not 500
      if (message.includes('not allowed') || message.includes('Expected')) {
        return NextResponse.json(fail('TRANSITION_NOT_ALLOWED', message), { status: 409 })
      }
      throw err
    }
  },
  {
    permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL,
    schema: TransitionSchema,
  },
)
