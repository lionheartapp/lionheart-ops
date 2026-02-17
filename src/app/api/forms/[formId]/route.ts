import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
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

/** PATCH /api/forms/[formId] — Update a form. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const { formId } = await params
      const existing = await prisma.form.findUnique({ where: { id: formId } })
      if (!existing) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders })
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
      }

      const prev = (existing.config as FormConfig) || {}
      const config: FormConfig = {
        showTitle: body.showTitle ?? prev.showTitle ?? true,
        fields: body.fields ?? prev.fields ?? [],
        layout: body.layout ?? prev.layout ?? 'default',
        formWidth: body.formWidth ?? prev.formWidth ?? 'standard',
        headerImage: body.headerImage ?? prev.headerImage ?? '',
        sideImage: body.sideImage ?? prev.sideImage ?? '',
        steps: body.steps ?? prev.steps ?? [],
        approvalWorkflow: body.approvalWorkflow !== undefined ? body.approvalWorkflow : prev.approvalWorkflow ?? null,
        submissionType: body.submissionType ?? prev.submissionType ?? 'general',
      }

      const form = await prisma.form.update({
        where: { id: formId },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() || existing.title }),
          ...(body.description !== undefined && { description: body.description ?? '' }),
          config: JSON.parse(JSON.stringify(config)),
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
    console.error('PATCH /api/forms/[formId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update form' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** DELETE /api/forms/[formId] — Delete a form (cascades to submissions). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const { formId } = await params
      const existing = await prisma.form.findUnique({ where: { id: formId } })
      if (!existing) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders })
      }
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
    console.error('DELETE /api/forms/[formId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete form' },
      { status: 500, headers: corsHeaders }
    )
  }
}
