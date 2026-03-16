/**
 * GET /api/events/templates/[id] — Get full template detail (including templateData)
 * POST /api/events/templates/[id] — Create an EventProject from this template
 * DELETE /api/events/templates/[id] — Hard-delete the template
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getTemplate, createFromTemplate, deleteTemplate } from '@/lib/services/eventTemplateService'
import { CreateFromTemplateInputSchema } from '@/lib/types/event-template'

/**
 * GET /api/events/templates/[id]
 * Returns full template detail including templateData JSON.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_TEMPLATES_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const template = await getTemplate(id)
      if (!template) {
        return NextResponse.json(fail('NOT_FOUND', 'Template not found'), { status: 404 })
      }
      return NextResponse.json(ok(template))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/events/templates/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * POST /api/events/templates/[id]
 * Create a new EventProject from this template.
 * Body: { title, startsAt, endsAt, locationText? }
 * Returns: { eventProjectId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    // Creating from template requires event create permission
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_CREATE)

    const body = await req.json()
    const parsed = CreateFromTemplateInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const result = await createFromTemplate(id, parsed.data, ctx.userId)
      return NextResponse.json(ok(result), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', error.issues),
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    console.error('[POST /api/events/templates/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE /api/events/templates/[id]
 * Hard-delete the template. Requires EVENTS_TEMPLATES_MANAGE.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_TEMPLATES_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      await deleteTemplate(id)
      return NextResponse.json(ok(null))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    console.error('[DELETE /api/events/templates/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
