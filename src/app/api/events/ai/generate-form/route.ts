/**
 * POST /api/events/ai/generate-form
 *
 * Generates a registration form structure based on event parameters.
 * Returns AI-suggested sections and fields that load into the existing FormBuilder.
 * Staff always reviews and edits before saving.
 *
 * Returns AIGeneratedForm or 503 if Gemini is not configured.
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateRegistrationForm } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  eventType: z.string().min(1, 'eventType is required').max(100),
  durationDays: z.number().int().min(1).max(365),
  expectedAttendance: z.number().int().min(1).max(10000),
  description: z.string().max(2000).optional(),
})

export const POST = withAuth(async ({ body }) => {
  const { eventType, durationDays, expectedAttendance, description } = body

  const form = await generateRegistrationForm({
    eventType,
    durationDays,
    expectedAttendance,
    description,
  })

  if (!form) {
    return NextResponse.json(
      fail(
        'AI_UNAVAILABLE',
        'AI form generation is not available. Please configure GEMINI_API_KEY to enable this feature.',
      ),
      { status: 503 },
    )
  }

  return NextResponse.json(ok(form))
}, { permission: PERMISSIONS.EVENTS_REGISTRATION_MANAGE, schema: BodySchema })
