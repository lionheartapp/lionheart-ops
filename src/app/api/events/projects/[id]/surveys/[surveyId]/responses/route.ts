/**
 * Survey Responses API.
 *
 * GET  /api/events/projects/[id]/surveys/[surveyId]/responses
 *      — Staff-only: retrieve aggregated survey results
 * POST /api/events/projects/[id]/surveys/[surveyId]/responses
 *      — Public (parent portal): submit a survey response
 *
 * GET requires EVENTS_SURVEYS_MANAGE permission.
 * POST is public — registration ID serves as the access credential.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSurveyResults, submitSurveyResponse } from '@/lib/services/eventSurveyService'

// ─── Schema ───────────────────────────────────────────────────────────────────

const SubmitResponseSchema = z.object({
  registrationId: z.string().cuid(),
  responses: z.record(z.string(), z.unknown()),
})

// ─── Route Handlers ──────────────────────────────────────────────────────────

/**
 * GET — Staff-only: retrieve aggregated survey results.
 * Requires EVENTS_SURVEYS_MANAGE permission.
 */
export const GET = withAuth(async ({ params }) => {
  const results = await getSurveyResults(params.surveyId)
  return NextResponse.json(ok(results))
}, { permission: PERMISSIONS.EVENTS_SURVEYS_MANAGE })

/**
 * POST — Public (parent portal): submit a survey response.
 * No staff auth required — registration ID serves as the access credential.
 * Validates that registrationId belongs to this event to prevent cross-event submission.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; surveyId: string }> },
) {
  try {
    const { surveyId } = await params
    const body = await req.json()
    const parsed = SubmitResponseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    // Service validates survey is ACTIVE and registrationId belongs to this event
    const result = await submitSurveyResponse({
      surveyId,
      registrationId: parsed.data.registrationId,
      responses: parsed.data.responses,
    })

    return NextResponse.json(ok(result), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      const msg = error.message
      if (msg === 'Survey not found' || msg === 'Registration not found') {
        return NextResponse.json(fail('NOT_FOUND', msg), { status: 404 })
      }
      if (
        msg === 'Survey is not accepting responses' ||
        msg === 'Survey has closed' ||
        msg === 'Response already submitted for this survey' ||
        msg === 'Registration does not belong to this event'
      ) {
        return NextResponse.json(fail('CONFLICT', msg), { status: 409 })
      }
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
