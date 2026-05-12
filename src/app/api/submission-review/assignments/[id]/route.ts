/**
 * GET   /api/submission-review/assignments/:id — get assignment with submissions
 * PATCH /api/submission-review/assignments/:id — update an assignment
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getAssignmentById,
  updateAssignment,
  updateAssignmentSchema,
} from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ params }) => {
  const assignment = await getAssignmentById(params.id)
  if (!assignment) {
    return NextResponse.json(fail('NOT_FOUND', 'Assignment not found'), { status: 404 })
  }
  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_READ })

export const PATCH = withAuth(async ({ params, body }) => {
  const assignment = await updateAssignment(params.id, body)
  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_UPDATE_OWN, schema: updateAssignmentSchema })
