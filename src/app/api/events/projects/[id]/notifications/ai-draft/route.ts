/**
 * POST /api/events/projects/[id]/notifications/ai-draft
 *
 * Generates an AI-drafted notification subject and body for a notification rule.
 * Requires EVENTS_NOTIFICATIONS_MANAGE permission.
 * Returns 503 AI_UNAVAILABLE if GEMINI_API_KEY is not configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { generateNotificationDraft } from '@/lib/services/ai/eventAIService'

const AIDraftInputSchema = z.object({
  eventTitle: z.string().min(1),
  eventDate: z.string().min(1),
  triggerType: z.string().min(1),
  targetAudience: z.string().min(1),
  context: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE)

    const body = await req.json()
    const parsed = AIDraftInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const draft = await generateNotificationDraft(parsed.data)

      if (!draft) {
        return NextResponse.json(
          fail('AI_UNAVAILABLE', 'AI drafting is not available — GEMINI_API_KEY not configured'),
          { status: 503 }
        )
      }

      return NextResponse.json(ok(draft))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
