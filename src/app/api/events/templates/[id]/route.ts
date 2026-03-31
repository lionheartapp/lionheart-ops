/**
 * GET /api/events/templates/[id] — Get full template detail (including templateData)
 * POST /api/events/templates/[id] — Create an EventProject from this template
 * DELETE /api/events/templates/[id] — Hard-delete the template
 */
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTemplate, createFromTemplate, deleteTemplate } from '@/lib/services/eventTemplateService'
import { CreateFromTemplateInputSchema } from '@/lib/types/event-template'

/**
 * GET /api/events/templates/[id]
 * Returns full template detail including templateData JSON.
 */
export const GET = withAuth(async ({ params }) => {
  const template = await getTemplate(params.id)
  if (!template) {
    return NextResponse.json(fail('NOT_FOUND', 'Template not found'), { status: 404 })
  }
  return NextResponse.json(ok(template))
}, { permission: PERMISSIONS.EVENTS_TEMPLATES_MANAGE })

/**
 * POST /api/events/templates/[id]
 * Create a new EventProject from this template.
 * Body: { title, startsAt, endsAt, locationText? }
 * Returns: { eventProjectId }
 */
export const POST = withAuth(async ({ params, ctx, body }) => {
  const result = await createFromTemplate(params.id, body, ctx.userId)
  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE, schema: CreateFromTemplateInputSchema })

/**
 * DELETE /api/events/templates/[id]
 * Hard-delete the template. Requires EVENTS_TEMPLATES_MANAGE.
 */
export const DELETE = withAuth(async ({ params }) => {
  await deleteTemplate(params.id)
  return NextResponse.json(ok(null))
}, { permission: PERMISSIONS.EVENTS_TEMPLATES_MANAGE })
