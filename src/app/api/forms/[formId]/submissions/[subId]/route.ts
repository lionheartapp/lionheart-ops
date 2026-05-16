/**
 * GET    /api/forms/:formId/submissions/:subId — Get a single submission
 * PATCH  /api/forms/:formId/submissions/:subId — Update status or draft data
 * DELETE /api/forms/:formId/submissions/:subId — Delete a submission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getSubmission,
  transitionStatus,
  updateDraft,
  submitDraft,
  deleteSubmission,
} from '@/lib/services/formSubmissionService'
import type { SubmissionStatus } from '@prisma/client'

export const GET = withAuth<unknown, { formId: string; subId: string }>(
  async ({ params }) => {
    const submission = await getSubmission(params.subId)
    if (!submission) {
      return NextResponse.json(fail('NOT_FOUND', 'Submission not found'), { status: 404 })
    }
    return NextResponse.json(ok(submission))
  }
)

const PatchSchema = z.object({
  status: z.enum(['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const PATCH = withAuth<z.infer<typeof PatchSchema>, { formId: string; subId: string }>(
  async ({ ctx, params, body }) => {
    // Update draft data
    if (body.data) {
      const updated = await updateDraft(params.subId, body.data)
      return NextResponse.json(ok(updated))
    }

    // Transition status
    if (body.status) {
      const updated = await transitionStatus(
        params.subId,
        body.status as SubmissionStatus,
        ctx.userId
      )
      return NextResponse.json(ok(updated))
    }

    return NextResponse.json(fail('BAD_REQUEST', 'Provide status or data'), { status: 400 })
  },
  { schema: PatchSchema }
)

export const DELETE = withAuth<unknown, { formId: string; subId: string }>(
  async ({ params }) => {
    await deleteSubmission(params.subId)
    return NextResponse.json(ok({ deleted: true }))
  },
  { permission: PERMISSIONS.FORMS_MANAGE }
)
