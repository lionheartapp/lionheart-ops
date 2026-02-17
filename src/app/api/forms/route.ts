import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

type FormConfig = {
  showTitle?: boolean
  fields?: unknown[]
  layout?: string
  formWidth?: string
  headerImage?: string
  sideImage?: string
  steps?: unknown[]
  approvalWorkflow?: { approverIds: string[]; type: string } | null
  submissionType?: string
}

function dbFormToFrontend(row: {
  id: string
  title: string
  description: string
  config: unknown
  visibility: string
  createdBy: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const config = (row.config as FormConfig) || {}
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    showTitle: config.showTitle ?? true,
    fields: config.fields ?? [],
    layout: config.layout ?? 'default',
    formWidth: config.formWidth ?? 'standard',
    headerImage: config.headerImage ?? '',
    sideImage: config.sideImage ?? '',
    steps: config.steps ?? [],
    approvalWorkflow: config.approvalWorkflow ?? null,
    submissionType: config.submissionType ?? 'general',
    createdBy: row.createdBy ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** GET /api/forms — List forms for the current org (and personal forms for current user). */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const authHeader = req.headers.get('authorization')
      let userId: string | undefined
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        userId = payload?.userId
      }
      const forms = await prisma.form.findMany({
        where: userId
          ? { OR: [{ visibility: 'org' }, { visibility: 'personal', createdByUserId: userId }] }
          : { visibility: 'org' },
        orderBy: { updatedAt: 'desc' },
      })
      return NextResponse.json(forms.map(dbFormToFrontend), { headers: corsHeaders })
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

/** POST /api/forms — Create a form. */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const authHeader = req.headers.get('authorization')
      let userId: string | undefined
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        userId = payload?.userId
      }

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
        approvalWorkflow?: { approverIds: string[]; type: string } | null
        submissionType?: string
        visibility?: string
      }

      const title = body.title?.trim() || 'Untitled form'
      const config: FormConfig = {
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
      const visibility = body.visibility === 'personal' ? 'personal' : 'org'

      let createdByName: string | null = null
      if (userId) {
        const user = await prismaBase.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        createdByName = user?.name ?? user?.email ?? null
      }

      const form = await prisma.form.create({
        data: {
          title,
          description: body.description ?? '',
          config: JSON.parse(JSON.stringify(config)),
          visibility,
          createdBy: createdByName,
          createdByUserId: visibility === 'personal' ? userId ?? null : null,
        },
      })
      return NextResponse.json(dbFormToFrontend(form), { headers: corsHeaders })
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
