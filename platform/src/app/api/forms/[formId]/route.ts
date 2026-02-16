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
  config: unknown
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

/** PATCH /api/forms/[formId] — Update a form */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    if (!formId) {
      return NextResponse.json({ error: 'Missing form ID' }, { status: 400, headers: corsHeaders })
    }

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

      const existing = await prisma.form.findFirst({ where: { id: formId } })
      if (!existing) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders })
      }

      const config = (existing.config as Record<string, unknown>) || {}
      const nextConfig = {
        showTitle: body.showTitle ?? config.showTitle ?? true,
        fields: body.fields ?? config.fields ?? [],
        layout: body.layout ?? config.layout ?? 'default',
        formWidth: body.formWidth ?? config.formWidth ?? 'standard',
        headerImage: body.headerImage ?? config.headerImage ?? '',
        sideImage: body.sideImage ?? config.sideImage ?? '',
        steps: body.steps ?? config.steps ?? [],
        approvalWorkflow: body.approvalWorkflow !== undefined ? body.approvalWorkflow : config.approvalWorkflow,
        submissionType: body.submissionType ?? config.submissionType ?? 'general',
      }

      const form = await prisma.form.update({
        where: { id: formId },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() }),
          ...(body.description !== undefined && { description: body.description.trim() }),
          config: nextConfig as object,
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
    console.error('PATCH /api/forms/[formId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update form' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** DELETE /api/forms/[formId] — Delete a form and its submissions */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    if (!formId) {
      return NextResponse.json({ error: 'Missing form ID' }, { status: 400, headers: corsHeaders })
    }

    return await withOrg(req, prismaBase, async () => {
      await prisma.form.delete({ where: { id: formId } })
      return new NextResponse(null, { status: 204, headers: corsHeaders })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    if ((err as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders })
    }
    console.error('DELETE /api/forms/[formId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete form' },
      { status: 500, headers: corsHeaders }
    )
  }
}
