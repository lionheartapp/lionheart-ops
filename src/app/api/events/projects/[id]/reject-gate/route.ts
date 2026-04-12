import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rejectGate } from '@/lib/services/eventProjectService'

const schema = z.object({
  gateType: z.enum(['admin', 'facilities', 'av', 'custodial', 'security', 'athletic_director']),
  reason: z.string().min(1, 'A reason is required when rejecting'),
})

/**
 * POST /api/events/projects/[id]/reject-gate
 *
 * Rejects a specific approval gate on an EventProject.
 * Sends the event back to DRAFT so the submitter can revise and resubmit.
 * Other approved gates are preserved — only the rejected gate needs re-approval.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  try {
    const result = await rejectGate(params.id, body.gateType, ctx.userId, body.reason)
    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Cannot reject') ||
      error.message.includes('No ')
    )) {
      return NextResponse.json(fail('INVALID_STATE', error.message), { status: 400 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENT_PROJECT_APPROVE, schema })
