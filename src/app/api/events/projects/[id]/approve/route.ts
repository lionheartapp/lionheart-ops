import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { approveEventProject } from '@/lib/services/eventProjectService'

/**
 * POST /api/events/projects/[id]/approve
 *
 * Approves a PENDING_APPROVAL EventProject, transitions it to CONFIRMED,
 * and creates the CalendarEvent bridge record via approveEventProject.
 *
 * Returns 400 if the project is not in PENDING_APPROVAL status.
 */
export const POST = withAuth(async ({ ctx, params }) => {
  try {
    const approved = await approveEventProject(params.id, ctx.userId)
    return NextResponse.json(ok(approved))
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Cannot approve') || error.message.includes('Expected PENDING_APPROVAL'))
    ) {
      return NextResponse.json(fail('INVALID_STATE', error.message), { status: 400 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENT_PROJECT_APPROVE })
