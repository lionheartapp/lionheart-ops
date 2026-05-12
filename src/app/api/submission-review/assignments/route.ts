/**
 * GET  /api/submission-review/assignments — list assignments
 * POST /api/submission-review/assignments — create a new assignment
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getAssignments,
  createAssignment,
  createAssignmentSchema,
} from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const assignments = await getAssignments(orgId, {
    schoolId: searchParams.get('schoolId') || undefined,
    campusId: searchParams.get('campusId') || undefined,
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
  })
  return NextResponse.json(ok(assignments))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_READ })

export const POST = withAuth(async ({ orgId, ctx, body }) => {
  const assignment = await createAssignment(orgId, ctx.userId, body)
  return NextResponse.json(ok(assignment), { status: 201 })
}, { permission: PERMISSIONS.SR_ASSIGNMENT_CREATE, schema: createAssignmentSchema })
