/**
 * GET  /api/forms/:formId/submissions — List submissions for a form
 * POST /api/forms/:formId/submissions — Create a new submission (authenticated)
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import {
  listSubmissions,
  createSubmission,
  getSubmissionCount,
} from '@/lib/services/formSubmissionService'
import { processFormActions } from '@/lib/services/formActionProcessor'
import { prisma } from '@/lib/db'
import type { SubmissionStatus } from '@prisma/client'

export const GET = withAuth<unknown, { formId: string }>(
  async ({ params, searchParams }) => {
    const { formId } = params
    const status = searchParams.get('status') as SubmissionStatus | null
    const search = searchParams.get('search') ?? undefined
    const isDraftParam = searchParams.get('isDraft')
    const isDraft = isDraftParam === 'true' ? true : isDraftParam === 'false' ? false : undefined

    const [submissions, counts] = await Promise.all([
      listSubmissions({ formId, status: status ?? undefined, search, isDraft }),
      getSubmissionCount(formId),
    ])

    return NextResponse.json(ok({ submissions, counts }))
  }
)

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
