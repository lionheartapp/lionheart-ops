/**
 * POST /api/submission-review/submissions — create a new submission
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createSubmission,
  createSubmissionSchema,
} from '@/lib/services/submissionReviewService'

export const POST = withAuth(async ({ orgId, ctx, body }) => {
  const submission = await createSubmission(orgId, ctx.userId, body)
  return NextResponse.json(ok(submission), { status: 201 })
}, { permission: PERMISSIONS.SR_ASSIGNMENT_READ, schema: createSubmissionSchema })
