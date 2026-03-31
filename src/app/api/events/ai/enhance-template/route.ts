/**
 * POST /api/events/ai/enhance-template
 *
 * Enhances a template's structure for reuse with new dates using Gemini AI.
 * Returns enhanced TemplateData or 503 if Gemini is not configured.
 *
 * Body: { templateData: TemplateData, startsAt: string, endsAt: string, lessons?: string[] }
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
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

export const POST = withAuth(async ({ body }) => {
  const enhanced = await enhanceTemplateForReuse(
    body.templateData as TemplateData,
    { startsAt: body.startsAt, endsAt: body.endsAt },
    body.lessons,
  )

  // enhanceTemplateForReuse returns the original templateData when AI is unavailable
  // We return the enhanced data regardless; the client determines if AI was available
  return NextResponse.json(ok(enhanced))
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE, schema: BodySchema })
