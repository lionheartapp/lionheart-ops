import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/** Map DB Form to frontend shape */
function toFrontendForm(f: {
  id: string
  title: string
  description: string
  config: object | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const config = (f.config || {}) as Record<string, unknown>
  return {
    id: f.id,
    title: f.title,
    description: f.description ?? '',
    showTitle: config.showTitle ?? true,
    fields: config.fields ?? [],
    layout: config.layout ?? 'default',
    formWidth: config.formWidth ?? 'standard',
    headerImage: config.headerImage ?? '',
    sideImage: config.sideImage ?? '',
    steps: config.steps ?? [],
    approvalWorkflow: config.approvalWorkflow ?? null,
    submissionType: config.submissionType ?? 'general',
    createdBy: f.createdBy ?? '',
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

/** GET /api/forms — Fetch all forms for the current organization */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const forms = await prisma.form.findMany({
        orderBy: { updatedAt: 'desc' },
      })
      return NextResponse.json(
        forms.map(toFrontendForm),
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
    console.error('GET /api/forms error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch forms' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** POST /api/forms — Create a new form template */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const body = (await req.json()) as {
        title?: string
        description?: string
        showTitle?: boolean
        fields?: unknown[]
        layout?: string
        formWidth?: string
        headerImage?: string
        sideImage?: string
        steps?: unknown[]
        approvalWorkflow?: unknown
        submissionType?: string
      }

      let createdBy: string | null = null
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) {
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { name: true, email: true },
          })
          createdBy = user?.name ?? user?.email ?? payload.userId
        }
      }

      const config = {
        showTitle: body.showTitle ?? true,
        fields: body.fields ?? [],
        layout: body.layout ?? 'default',
        formWidth: body.formWidth ?? 'standard',
        headerImage: body.headerImage ?? '',
        sideImage: body.sideImage ?? '',
        steps: body.steps ?? [],
        approvalWorkflow: body.approvalWorkflow ?? null,
        submissionType: body.submissionType ?? 'general',
      }

      const form = await prisma.form.create({
        data: {
          title: (body.title ?? 'Untitled form').trim(),
          description: (body.description ?? '').trim(),
          config: config as object,
          createdBy: createdBy ?? null,
        },
      })

      return NextResponse.json(toFrontendForm(form), { headers: corsHeaders })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('POST /api/forms error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create form' },
      { status: 500, headers: corsHeaders }
    )
  }
}
