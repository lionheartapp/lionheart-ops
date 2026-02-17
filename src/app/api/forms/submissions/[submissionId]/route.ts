import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

function dbSubmissionToFrontend(row: {
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
    id: row.id,
    formId: row.formId,
    data: row.data ?? {},
    status: row.status ?? 'submitted',
    approvals: row.approvals ?? null,
    submittedBy: row.submittedBy ?? undefined,
    submittedAt: row.createdAt.toISOString(),
    eventId: row.eventId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

/** PATCH /api/forms/submissions/[submissionId] — Update submission (e.g. approval status, eventId). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const { submissionId } = await params
      const formIds = (await prisma.form.findMany({ select: { id: true } })).map((f) => f.id)
      const existing = await prismaBase.formSubmission.findUnique({
        where: { id: submissionId },
      })
      if (!existing || !formIds.includes(existing.formId)) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404, headers: corsHeaders })
      }

      const body = (await req.json()) as {
        status?: string
        approvals?: unknown
        eventId?: string | null
      }

      const data: { status?: string; approvals?: unknown; eventId?: string | null } = {}
      if (body.status !== undefined) data.status = body.status
      if (body.approvals !== undefined) data.approvals = JSON.parse(JSON.stringify(body.approvals))
      if (body.eventId !== undefined) data.eventId = body.eventId || null

      const sub = await prismaBase.formSubmission.update({
        where: { id: submissionId },
        data: data as { status?: string; approvals?: object; eventId?: string | null },
      })
      return NextResponse.json(dbSubmissionToFrontend(sub), { headers: corsHeaders })
    })
  } catch (err) {
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
