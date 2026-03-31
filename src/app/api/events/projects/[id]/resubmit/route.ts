import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { resubmitForApproval } from '@/lib/services/eventProjectService'

/**
 * POST /api/events/projects/[id]/resubmit
 *
 * Resubmits a DRAFT EventProject after revision following a rejection.
 * Resets rejected gates back to PENDING and transitions to PENDING_APPROVAL.
 * Only the event creator can resubmit.
 */
export const POST = withAuth(async ({ ctx, params }) => {
  try {
    const result = await resubmitForApproval(params.id, ctx.userId)
    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Cannot resubmit') ||
      error.message.includes('Only the creator') ||
      error.message.includes('No approval gates')
    )) {
      return NextResponse.json(fail('INVALID_STATE', error.message), { status: 400 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE })
