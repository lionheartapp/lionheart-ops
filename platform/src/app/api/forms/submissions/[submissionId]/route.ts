import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'

/** Map DB FormSubmission to frontend shape */
function toFrontendSubmission(s: {
  id: string
  formId: string
  data: unknown
  status: string
  approvals: unknown
  submittedBy: string | null
  eventId: string | null
  createdAt: Date
}) {
  return {
    id: s.id,
    formId: s.formId,
    data: (typeof s.data === 'object' && s.data !== null ? s.data : {}) as Record<string, unknown>,
    submittedAt: s.createdAt.toISOString(),
    submittedBy: s.submittedBy ?? 'Unknown',
    status: s.status ?? 'submitted',
    approvals: s.approvals ?? null,
    eventId: s.eventId ?? undefined,
  }
}

/** PATCH /api/forms/submissions/[submissionId] — Update submission (e.g. approve/reject) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Missing submission ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const body = (await req.json()) as {
        status?: string
        approvals?: unknown[]
        eventId?: string | null
      }

      const orgId = getOrgId()
      const existing = await prisma.formSubmission.findFirst({
        where: {
          id: submissionId,
          form: orgId ? { organizationId: orgId } : undefined,
        },
      })
      if (!existing) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404, headers: corsHeaders }
        )
      }

      const submission = await prisma.formSubmission.update({
        where: { id: submissionId },
        data: {
          ...(body.status !== undefined && { status: body.status }),
          ...(body.approvals !== undefined && { approvals: body.approvals as object }),
          ...(body.eventId !== undefined && { eventId: body.eventId }),
        },
      })

      return NextResponse.json(toFrontendSubmission(submission), {
        headers: corsHeaders,
      })
    })
  } catch (err) {
    if (err instanceof PlanRestrictedError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402, headers: corsHeaders })
    }
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('PATCH /api/forms/submissions/[submissionId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update submission' },
      { status: 500, headers: corsHeaders }
    )
  }
}
