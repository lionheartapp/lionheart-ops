/**
 * POST /api/events/ai/generate-schedule
 *
 * Generates a multi-day schedule from event parameters using Gemini AI.
 * Returns AIScheduleSuggestion or 503 if Gemini is not configured.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { generateSchedule } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  eventType: z.string().min(1, 'eventType is required').max(100),
  durationDays: z.number().int().min(1).max(30),
  expectedAttendance: z.number().int().min(1).max(10000),
  description: z.string().max(1000).optional(),
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
      const schedule = await generateSchedule(parsed.data)

      if (!schedule) {
        return NextResponse.json(
          fail(
            'AI_UNAVAILABLE',
            'AI schedule generation is not available. Please configure GEMINI_API_KEY to enable this feature.',
          ),
          { status: 503 },
        )
      }

      return NextResponse.json(ok(schedule))
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
    console.error('[POST /api/events/ai/generate-schedule]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
