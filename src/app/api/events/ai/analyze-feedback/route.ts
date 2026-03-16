/**
 * POST /api/events/ai/analyze-feedback
 *
 * Analyzes post-event survey responses for an EventProject.
 * Loads all surveys and their responses, then sends to Gemini for
 * theme extraction, sentiment analysis, and action item generation.
 *
 * Returns AIFeedbackAnalysis or 503 if Gemini is not configured.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { analyzeFeedback } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  eventProjectId: z.string().min(1, 'eventProjectId is required'),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_SURVEYS_MANAGE)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const { eventProjectId } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      // Load surveys with their form sections and responses
      const surveys = await (prisma as any).eventSurvey.findMany({
        where: { eventProjectId },
        include: {
          form: {
            include: {
              sections: {
                include: {
                  fields: {
                    where: {
                      inputType: { in: ['TEXT', 'DROPDOWN'] },
                      enabled: true,
                    },
                    select: { id: true, label: true },
                    orderBy: { sortOrder: 'asc' },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          responses: {
            include: {
              registration: {
                select: { id: true },
              },
            },
          },
        },
      })

      if (surveys.length === 0) {
        return NextResponse.json(
          fail('NO_SURVEYS', 'No surveys found for this event.'),
          { status: 400 },
        )
      }

      // Aggregate responses per question
      const questionAnswers: Record<string, { question: string; answers: string[] }> = {}

      for (const survey of surveys) {
        // Build field label map
        const fieldLabels: Record<string, string> = {}
        for (const section of survey.form.sections) {
          for (const field of section.fields) {
            fieldLabels[field.id] = field.label
          }
        }

        // Aggregate all responses
        for (const response of survey.responses) {
          const responseData = response.responses as Record<string, string | string[]>

          for (const [fieldId, value] of Object.entries(responseData)) {
            const label = fieldLabels[fieldId]
            if (!label) continue

            if (!questionAnswers[fieldId]) {
              questionAnswers[fieldId] = { question: label, answers: [] }
            }

            if (typeof value === 'string' && value.trim()) {
              questionAnswers[fieldId].answers.push(value.trim())
            } else if (Array.isArray(value)) {
              questionAnswers[fieldId].answers.push(...value.filter((v) => v.trim()))
            }
          }
        }
      }

      // Only include questions that have text answers
      const surveyResponses = Object.values(questionAnswers).filter(
        ({ answers }) => answers.length > 0,
      )

      if (surveyResponses.length === 0) {
        return NextResponse.json(
          fail('NO_RESPONSES', 'No survey responses found for this event.'),
          { status: 400 },
        )
      }

      const analysis = await analyzeFeedback(surveyResponses)

      if (!analysis) {
        return NextResponse.json(
          fail(
            'AI_UNAVAILABLE',
            'Feedback analysis is not available. Please configure GEMINI_API_KEY to enable this feature.',
          ),
          { status: 503 },
        )
      }

      return NextResponse.json(
        ok({
          ...analysis,
          responseCount: surveys.reduce(
            (sum: number, s: any) => sum + s.responses.length,
            0,
          ),
        }),
      )
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
    console.error('[POST /api/events/ai/analyze-feedback]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
