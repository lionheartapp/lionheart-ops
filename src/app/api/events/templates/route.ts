/**
 * GET /api/events/templates — List templates for current org
 * POST /api/events/templates — Save an EventProject as a template
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
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
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_TEMPLATES_MANAGE)

    const { searchParams } = new URL(req.url)
    const eventType = searchParams.get('eventType') ?? undefined

    return await runWithOrgContext(orgId, async () => {
      const templates = await getTemplates({ eventType })
      return NextResponse.json(ok(templates))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/events/templates]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * POST /api/events/templates
 * Body: { eventProjectId, name, description?, eventType? }
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_TEMPLATES_MANAGE)

    const body = await req.json()
    const parsed = SaveTemplateBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const { eventProjectId, ...templateInput } = parsed.data
    const validatedInput = CreateTemplateInputSchema.parse(templateInput)

    return await runWithOrgContext(orgId, async () => {
      const template = await saveAsTemplate(eventProjectId, validatedInput, ctx.userId)
      return NextResponse.json(ok(template), { status: 201 })
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
    console.error('[POST /api/events/templates]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
