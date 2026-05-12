/**
 * POST /api/submission-review/assignments/:id/publish — publish an assignment
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { publishAssignment } from '@/lib/services/submissionReviewService'

export const POST = withAuth(async ({ params }) => {
  const assignment = await publishAssignment(params.id)
  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_UPDATE_OWN })
