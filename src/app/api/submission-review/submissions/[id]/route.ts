/**
 * GET /api/submission-review/submissions/:id — get submission with all signal data
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubmissionById } from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ params }) => {
  const submission = await getSubmissionById(params.id)
  if (!submission) {
    return NextResponse.json(fail('NOT_FOUND', 'Submission not found'), { status: 404 })
  }
  return NextResponse.json(ok(submission))
}, { permission: PERMISSIONS.SR_REVIEW_READ })
