/**
 * POST /api/f/[formId]/submit — Public form submission (no auth required)
 *
 * Creates a FormSubmission record with the submitted data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- Public form submission has no auth; it only accepts active forms marked isPublic and writes with that form's organizationId.
import { rawPrisma } from '@/lib/db'
import { processFormActions } from '@/lib/services/formActionProcessor'

const SubmitSchema = z.object({
  data: z.record(z.string(), z.string()),
  submitterEmail: z.string().email().nullable().optional(),
  submitterName: z.string().nullable().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params

  try {
    const body = await req.json()
    const parsed = SubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid submission data'),
        { status: 400 }
      )
    }

    // Verify form exists and get its org + settings
    const form = await rawPrisma.formDefinition.findFirst({
      where: {
        id: formId,
        isPublic: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        organizationId: true,
        requireEmail: true,
      },
    })

    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
    }

    // Validate email requirement
    if (form.requireEmail && !parsed.data.submitterEmail?.trim()) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Email address is required'),
        { status: 400 }
      )
    }

    // Create submission
    const submission = await rawPrisma.formSubmission.create({
      data: {
        organizationId: form.organizationId,
        formId: form.id,
        data: parsed.data.data,
        submitterEmail: parsed.data.submitterEmail ?? null,
        submitterName: parsed.data.submitterName ?? null,
        status: 'SUBMITTED',
      },
    })

    // Fire-and-forget: process post-submission actions
    processFormActions({
      submissionId: submission.id,
      formId: form.id,
      formName: null,
      orgId: form.organizationId,
      submitterEmail: parsed.data.submitterEmail ?? null,
      submitterName: parsed.data.submitterName ?? null,
      data: parsed.data.data,
    }).catch(() => {})

    return NextResponse.json(ok({ id: submission.id }), { status: 201 })
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Submission failed'), { status: 500 })
  }
}
