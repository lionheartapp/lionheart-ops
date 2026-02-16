import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/** Map DB FormSubmission to frontend shape */
function toFrontendSubmission(s: {
  id: string
  formId: string
  data: object
  status: string
  approvals: unknown
  submittedBy: string | null
  eventId: string | null
  createdAt: Date
}) {
  return {
    id: s.id,
    formId: s.formId,
    data: s.data ?? {},
    submittedAt: s.createdAt.toISOString(),
    submittedBy: s.submittedBy ?? 'Unknown',
    status: s.status ?? 'submitted',
    approvals: s.approvals ?? null,
    eventId: s.eventId ?? undefined,
  }
}

/** GET /api/forms/submissions — List submissions (optional formId filter) */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const { searchParams } = new URL(req.url)
      const formId = searchParams.get('formId')
      const orgId = getOrgId()

      const where = orgId
        ? {
            form: { organizationId: orgId },
            ...(formId ? { formId } : {}),
          }
        : formId
          ? { formId }
          : {}

      const submissions = await prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(
        submissions.map(toFrontendSubmission),
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('GET /api/forms/submissions error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch submissions' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** POST /api/forms/submissions — Create a new submission */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const body = (await req.json()) as {
        formId: string
        data: Record<string, unknown>
        status?: string
        approvals?: unknown[]
      }

      const { formId, data } = body
      if (!formId?.trim()) {
        return NextResponse.json(
          { error: 'Missing formId' },
          { status: 400, headers: corsHeaders }
        )
      }

      const orgId = getOrgId()
      const form = await prisma.form.findFirst({
        where: {
          id: formId.trim(),
          ...(orgId ? { organizationId: orgId } : {}),
        },
      })
      if (!form) {
        return NextResponse.json(
          { error: 'Form not found or access denied' },
          { status: 404, headers: corsHeaders }
        )
      }

      let submittedBy: string | null = null
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) {
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { name: true, email: true },
          })
          submittedBy = user?.name ?? user?.email ?? payload.userId
        }
      }

      const workflow = (form.config as Record<string, unknown>)?.approvalWorkflow as
        | { approverIds?: string[] }
        | undefined
      const hasApproval = workflow?.approverIds?.length > 0
      const status = body.status ?? (hasApproval ? 'pending' : 'approved')
      const approvals = body.approvals ?? (hasApproval
        ? (workflow.approverIds ?? []).map((id: string) => ({
            approverId: id,
            approved: null,
            at: null,
          }))
        : null)

      const submission = await prisma.formSubmission.create({
        data: {
          formId: formId.trim(),
          data: (data ?? {}) as object,
          status,
          approvals: approvals as object,
          submittedBy,
        },
      })

      return NextResponse.json(toFrontendSubmission(submission), {
        status: 201,
        headers: corsHeaders,
      })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('POST /api/forms/submissions error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create submission' },
      { status: 500, headers: corsHeaders }
    )
  }
}
