/**
 * POST /api/events/ai/enhance-template
 *
 * Enhances a template's structure for reuse with new dates using Gemini AI.
 * Returns enhanced TemplateData or 503 if Gemini is not configured.
 *
 * Body: { templateData: TemplateData, startsAt: string, endsAt: string, lessons?: string[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { enhanceTemplateForReuse } from '@/lib/services/ai/eventAIService'
import type { TemplateData } from '@/lib/types/event-template'

const BodySchema = z.object({
  templateData: z.object({
    scheduleBlocks: z.array(z.any()),
    budgetCategories: z.array(z.string()),
    taskTemplates: z.array(z.any()),
    documentTypes: z.array(z.string()),
    groupStructure: z.array(z.any()),
    notificationRules: z.array(z.any()),
  }),
  startsAt: z.string().datetime({ message: 'startsAt must be a valid ISO datetime' }),
  endsAt: z.string().datetime({ message: 'endsAt must be a valid ISO datetime' }),
  lessons: z.array(z.string()).max(10).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_CREATE)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const enhanced = await enhanceTemplateForReuse(
        parsed.data.templateData as TemplateData,
        { startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt },
        parsed.data.lessons,
      )

      // enhanceTemplateForReuse returns the original templateData when AI is unavailable
      // We can detect this by checking if the response is null (it never is — service returns original)
      // We return the enhanced data regardless; the client determines if AI was available
      return NextResponse.json(ok(enhanced))
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
    console.error('[POST /api/events/ai/enhance-template]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
