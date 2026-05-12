/**
 * GET /api/submission-review/policies/effective?assignmentId=xxx
 * Resolve the effective policy for an assignment (cascade logic).
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getEffectivePolicy } from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const assignmentId = searchParams.get('assignmentId')
  if (!assignmentId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'assignmentId is required'), { status: 400 })
  }

  const policy = await getEffectivePolicy(orgId, assignmentId)
  return NextResponse.json(ok(policy))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_READ })
