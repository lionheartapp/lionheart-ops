/**
 * GET /api/events/templates — List templates for current org
 * POST /api/events/templates — Save an EventProject as a template
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTemplates, saveAsTemplate } from '@/lib/services/eventTemplateService'
import { CreateTemplateInputSchema } from '@/lib/types/event-template'

const SaveTemplateBodySchema = z.object({
  eventProjectId: z.string().min(1, 'eventProjectId is required'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  eventType: z.string().max(100).optional(),
})

/**
 * GET /api/events/templates
 * Optional query: ?eventType=camp
 */
export const GET = withAuth(async ({ searchParams }) => {
  const eventType = searchParams.get('eventType') ?? undefined

  const templates = await getTemplates({ eventType })
  return NextResponse.json(ok(templates))
}, { permission: PERMISSIONS.EVENTS_TEMPLATES_MANAGE })

/**
 * POST /api/events/templates
 * Body: { eventProjectId, name, description?, eventType? }
 */
export const POST = withAuth(async ({ ctx, body }) => {
  const { eventProjectId, ...templateInput } = body
  const validatedInput = CreateTemplateInputSchema.parse(templateInput)

  const template = await saveAsTemplate(eventProjectId, validatedInput, ctx.userId)
  return NextResponse.json(ok(template), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_TEMPLATES_MANAGE, schema: SaveTemplateBodySchema })
