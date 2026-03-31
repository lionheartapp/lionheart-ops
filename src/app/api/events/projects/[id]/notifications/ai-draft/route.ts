/**
 * POST /api/events/projects/[id]/notifications/ai-draft
 *
 * Generates an AI-drafted notification subject and body for a notification rule.
 * Requires EVENTS_NOTIFICATIONS_MANAGE permission.
 * Returns 503 AI_UNAVAILABLE if GEMINI_API_KEY is not configured.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateNotificationDraft } from '@/lib/services/ai/eventAIService'

const AIDraftInputSchema = z.object({
  eventTitle: z.string().min(1),
  eventDate: z.string().min(1),
  triggerType: z.string().min(1),
  targetAudience: z.string().min(1),
  context: z.string().optional(),
})

export const POST = withAuth(async ({ body }) => {
  const draft = await generateNotificationDraft(body)

  if (!draft) {
    return NextResponse.json(
      fail('AI_UNAVAILABLE', 'AI drafting is not available — GEMINI_API_KEY not configured'),
      { status: 503 }
    )
  }

  return NextResponse.json(ok(draft))
}, { permission: PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE, schema: AIDraftInputSchema })
