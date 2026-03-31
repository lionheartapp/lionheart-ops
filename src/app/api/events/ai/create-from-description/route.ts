/**
 * POST /api/events/ai/create-from-description
 *
 * Generates a structured event suggestion from a natural language description.
 * Returns AIEventSuggestion or 503 if Gemini is not configured.
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateEventFromDescription } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  existingEvents: z.array(z.string()).max(10).optional(),
})

export const POST = withAuth(async ({ body }) => {
  const { description, existingEvents } = body

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
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE, schema: BodySchema })
