/**
 * POST /api/submission-review/submissions/:id/reopen — reopen a resolved submission
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { reopenSubmission } from '@/lib/services/submissionReviewService'

export const POST = withAuth(async ({ ctx, params }) => {
  const resolution = await reopenSubmission(params.id, ctx.userId)
  return NextResponse.json(ok(resolution))
}, { permission: PERMISSIONS.SR_REVIEW_REOPEN })
