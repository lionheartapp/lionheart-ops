/**
 * POST /api/events/ai/generate-summary
 *
 * Generates a natural language status summary for an EventProject.
 * Two-phase pattern:
 *   - ?skipAI=true → returns raw metrics without AI summary
 *   - default → returns AIStatusSummary with AI-generated narrative
 *
 * Returns AIStatusSummary or 503 if Gemini is not configured.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { generateStatusSummary } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  eventProjectId: z.string().min(1, 'eventProjectId is required'),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const { eventProjectId } = parsed.data
    const skipAI = req.nextUrl.searchParams.get('skipAI') === 'true'

    return await runWithOrgContext(orgId, async () => {
      // Load event with metrics
      const project = await (prisma as any).eventProject.findFirst({
        where: { id: eventProjectId },
        include: {
          tasks: {
            select: { id: true, status: true },
          },
          registrations: {
            select: { id: true },
          },
          documentRequirements: {
            select: { id: true },
            include: {
              completions: {
                select: { id: true },
              },
            },
          },
        },
      })

      if (!project) {
        return NextResponse.json(fail('NOT_FOUND', 'EventProject not found'), { status: 404 })
      }

      // Compute raw metrics
      const totalTasks = project.tasks.length
      const completedTasks = project.tasks.filter((t: any) => t.status === 'DONE').length
      const registrationCount = project.registrations.length

      // Document completion: count requirements that have at least one completion
      const totalDocs = project.documentRequirements.length
      const completedDocs = project.documentRequirements.filter(
        (d: any) => d.completions.length > 0,
      ).length
      const documentCompletionPercent =
        totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0

      const now = new Date()
      const daysUntilEvent = Math.max(
        0,
        Math.ceil((new Date(project.startsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )

      // Budget utilization placeholder — 0 until budget module is wired in
      const budgetUtilization = 0

      const rawMetrics = {
        title: project.title,
        status: project.status,
        registrationCount,
        totalTasks,
        completedTasks,
        documentCompletionPercent,
        budgetUtilization,
        daysUntilEvent,
      }

      // Fast path: return raw metrics without AI
      if (skipAI) {
        return NextResponse.json(
          ok({
            ...rawMetrics,
            summary: null,
            completionPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            atRisk: [],
            nextSteps: [],
            aiGenerated: false,
          }),
        )
      }

      // Full path: AI-generated summary
      const summary = await generateStatusSummary(rawMetrics)

      if (!summary) {
        return NextResponse.json(
          fail(
            'AI_UNAVAILABLE',
            'AI summary generation is not available. Please configure GEMINI_API_KEY to enable this feature.',
          ),
          { status: 503 },
        )
      }

      return NextResponse.json(
        ok({
          ...rawMetrics,
          ...summary,
          aiGenerated: true,
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
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    console.error('[POST /api/events/ai/generate-summary]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
