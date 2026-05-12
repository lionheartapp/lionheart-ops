/**
 * GET /api/submission-review/queue — teacher review queue
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getReviewQueue } from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const queue = await getReviewQueue(orgId, {
    assignmentId: searchParams.get('assignmentId') || undefined,
    status: searchParams.get('status') || undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    campusId: searchParams.get('campusId') || undefined,
  })
  return NextResponse.json(ok(queue))
}, { permission: PERMISSIONS.SR_REVIEW_READ })
