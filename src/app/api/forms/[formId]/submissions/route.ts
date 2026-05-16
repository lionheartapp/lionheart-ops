/**
 * GET  /api/forms/:formId/submissions — List submissions for a form
 * POST /api/forms/:formId/submissions — Create a new submission (authenticated)
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { can } from '@/lib/auth/permissions'
import {
  listSubmissions,
  createSubmission,
  getSubmissionCount,
} from '@/lib/services/formSubmissionService'
import { processFormActions } from '@/lib/services/formActionProcessor'
import { prisma } from '@/lib/db'
import type { SubmissionStatus, FieldSensitivity } from '@prisma/client'

export const GET = withAuth<unknown, { formId: string }>(
  async ({ ctx, params, searchParams }) => {
    const { formId } = params
    const status = searchParams.get('status') as SubmissionStatus | null
    const search = searchParams.get('search') ?? undefined
    const isDraftParam = searchParams.get('isDraft')
    const isDraft = isDraftParam === 'true' ? true : isDraftParam === 'false' ? false : undefined

    const [submissions, counts] = await Promise.all([
      listSubmissions({ formId, status: status ?? undefined, search, isDraft }),
      getSubmissionCount(formId),
    ])

    // FERPA enforcement: redact FERPA_PROTECTED field values for unauthorized users
    const canReadFerpa = await can(ctx.userId, PERMISSIONS.FORMS_FERPA_READ)
    if (!canReadFerpa) {
      const ferpaKeys = await getFerpaFieldKeys(formId)
      if (ferpaKeys.size > 0) {
        for (const sub of submissions) {
          const data = (sub.data ?? {}) as Record<string, unknown>
          for (const key of ferpaKeys) {
            if (key in data) {
              data[key] = '[FERPA Protected]'
            }
          }
        }
      }
    }

    return NextResponse.json(ok({ submissions, counts }))
  }
)

/** Cache of FERPA field keys per form to avoid repeated queries */
async function getFerpaFieldKeys(formId: string): Promise<Set<string>> {
  const fields = await prisma.formField.findMany({
    where: { formId, sensitivityLevel: 'FERPA_PROTECTED' as FieldSensitivity },
    select: { key: true },
  })
  return new Set(fields.map((f) => f.key))
}

const CreateSubmissionSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  isDraft: z.boolean().optional().default(false),
  submitterName: z.string().nullable().optional(),
  submitterEmail: z.string().email().nullable().optional(),
})

export const POST = withAuth<z.infer<typeof CreateSubmissionSchema>, { formId: string }>(
  async ({ ctx, params, body }) => {
    const submission = await createSubmission({
      formId: params.formId,
      submittedBy: ctx.userId,
      submitterName: body.submitterName ?? null,
      submitterEmail: body.submitterEmail ?? ctx.email ?? null,
      data: body.data,
      isDraft: body.isDraft,
    })

    // Fire-and-forget: process post-submission actions (notify, approve, webhook)
    if (!body.isDraft) {
      const form = await prisma.formDefinition.findUnique({
        where: { id: params.formId },
        select: { description: true, organizationId: true },
      })
      processFormActions({
        submissionId: submission.id,
        formId: params.formId,
        formName: form?.description ?? null,
        orgId: form?.organizationId ?? '',
        submitterEmail: body.submitterEmail ?? ctx.email ?? null,
        submitterName: body.submitterName ?? null,
        data: body.data,
      }).catch(() => {})
    }

    return NextResponse.json(ok(submission), { status: 201 })
  },
  { schema: CreateSubmissionSchema }
)
