/**
 * POST /api/submission-review/assignments/:id/close — close an assignment
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { closeAssignment } from '@/lib/services/submissionReviewService'

export const POST = withAuth(async ({ params }) => {
  const assignment = await closeAssignment(params.id)
  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_UPDATE_OWN })
