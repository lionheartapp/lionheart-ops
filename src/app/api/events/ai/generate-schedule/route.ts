/**
 * POST /api/events/ai/generate-schedule
 *
 * Generates a multi-day schedule from event parameters using Gemini AI.
 * Returns AIScheduleSuggestion or 503 if Gemini is not configured.
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateSchedule } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  eventType: z.string().min(1, 'eventType is required').max(100),
  durationDays: z.number().int().min(1).max(30),
  expectedAttendance: z.number().int().min(1).max(10000),
  description: z.string().max(1000).optional(),
})

export const POST = withAuth(async ({ body }) => {
  const schedule = await generateSchedule(body)

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
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE, schema: BodySchema })
