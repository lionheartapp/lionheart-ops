/**
 * POST /api/events/ai/create-from-description
 *
 * Generates a structured event suggestion from a natural language description.
 * Returns AIEventSuggestion or 503 if Gemini is not configured.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { generateEventFromDescription } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  existingEvents: z.array(z.string()).max(10).optional(),
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

    const { description, existingEvents } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const suggestion = await generateEventFromDescription(description, {
        existingEvents,
      })

      if (!suggestion) {
        return NextResponse.json(
          fail(
            'AI_UNAVAILABLE',
            'AI event generation is not available. Please configure GEMINI_API_KEY to enable this feature.',
          ),
          { status: 503 },
        )
      }

      return NextResponse.json(ok(suggestion))
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
    console.error('[POST /api/events/ai/create-from-description]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
