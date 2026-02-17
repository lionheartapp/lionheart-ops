import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
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

/** GET /api/forms/submissions — List submissions (optionally filter by formId). */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const formIds = (await prisma.form.findMany({ select: { id: true } })).map((f) => f.id)
      if (formIds.length === 0) {
        return NextResponse.json([], { headers: corsHeaders })
      }
      const url = new URL(req.url)
      const formId = url.searchParams.get('formId')?.trim()
      const submissions = await prismaBase.formSubmission.findMany({
        where: {
          formId: formId && formIds.includes(formId) ? formId : { in: formIds },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(submissions.map(dbSubmissionToFrontend), { headers: corsHeaders })
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

/** POST /api/forms/submissions — Create a submission. */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const formIds = (await prisma.form.findMany({ select: { id: true } })).map((f) => f.id)
      const body = (await req.json()) as { formId: string; data?: Record<string, unknown> }
      const formId = body.formId?.trim()
      if (!formId || !formIds.includes(formId)) {
        return NextResponse.json({ error: 'Invalid or unknown form' }, { status: 400, headers: corsHeaders })
      }

      let submittedBy: string | null = null
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) {
          const user = await prismaBase.user.findUnique({
            where: { id: payload.userId },
            select: { name: true, email: true },
          })
          submittedBy = user?.name ?? user?.email ?? null
        }
      }

      const sub = await prismaBase.formSubmission.create({
        data: {
          formId,
          data: JSON.parse(JSON.stringify(body.data ?? {})),
          status: 'submitted',
          submittedBy,
        },
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
    console.error('POST /api/forms/submissions error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create submission' },
      { status: 500, headers: corsHeaders }
    )
  }
}
