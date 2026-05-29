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
import { can } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db'
import {
  getSubmission,
  transitionStatus,
  updateDraft,
  submitDraft,
  deleteSubmission,
} from '@/lib/services/formSubmissionService'
import type { SubmissionStatus, FieldSensitivity } from '@prisma/client'

// @authOnly Submission detail allows forms managers or the submitting user; status changes require forms-manage.
export const GET = withAuth<unknown, { formId: string; subId: string }>(
  async ({ ctx, params }) => {
    const submission = await getSubmission(params.subId)
    if (!submission) {
      return NextResponse.json(fail('NOT_FOUND', 'Submission not found'), { status: 404 })
    }
    const canManageForms = await can(ctx.userId, PERMISSIONS.FORMS_MANAGE)
    if (!canManageForms && submission.submittedBy !== ctx.userId) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to view this submission'), { status: 403 })
    }

    // FERPA enforcement
    const canReadFerpa = await can(ctx.userId, PERMISSIONS.FORMS_FERPA_READ)
    if (!canReadFerpa) {
      const ferpaFields = await prisma.formField.findMany({
        where: { formId: params.formId, sensitivityLevel: 'FERPA_PROTECTED' as FieldSensitivity },
        select: { key: true },
      })
      const data = (submission.data ?? {}) as Record<string, unknown>
      for (const f of ferpaFields) {
        if (f.key in data) {
          data[f.key] = '[FERPA Protected]'
        }
      }
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
      const submission = await getSubmission(params.subId)
      if (!submission) {
        return NextResponse.json(fail('NOT_FOUND', 'Submission not found'), { status: 404 })
      }
      const canManageForms = await can(ctx.userId, PERMISSIONS.FORMS_MANAGE)
      if (!canManageForms && submission.submittedBy !== ctx.userId) {
        return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to edit this draft'), { status: 403 })
      }
      const updated = await updateDraft(params.subId, body.data)
      return NextResponse.json(ok(updated))
    }

    // Transition status
    if (body.status) {
      const canManageForms = await can(ctx.userId, PERMISSIONS.FORMS_MANAGE)
      if (!canManageForms) {
        return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to update submission status'), { status: 403 })
      }
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
