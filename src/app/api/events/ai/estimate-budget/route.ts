/**
 * POST /api/events/ai/estimate-budget
 *
 * Estimates a budget for an EventProject.
 * Uses historical budget data from similar past events when available (3+),
 * falls back to AI estimation via Gemini otherwise.
 *
 * Body: { eventProjectId } or { eventType, durationDays, expectedAttendance }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { estimateBudgetFromHistory } from '@/lib/services/ai/eventAIService'

const BodySchema = z.union([
  z.object({
    eventProjectId: z.string().min(1),
  }),
  z.object({
    eventType: z.string().min(1).max(100),
    durationDays: z.number().int().min(1).max(365),
    expectedAttendance: z.number().int().min(1).max(10000),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_READ)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const data = parsed.data

    return await runWithOrgContext(orgId, async () => {
      let eventType: string | undefined
      let durationDays: number
      let expectedAttendance: number

      if ('eventProjectId' in data) {
        // Load from event project
        const project = await (prisma as any).eventProject.findFirst({
          where: { id: data.eventProjectId },
          select: {
            title: true,
            startsAt: true,
            endsAt: true,
            expectedAttendance: true,
          },
        })

        if (!project) {
          return NextResponse.json(fail('NOT_FOUND', 'EventProject not found'), { status: 404 })
        }

        const durationMs = new Date(project.endsAt).getTime() - new Date(project.startsAt).getTime()
        durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)))
        expectedAttendance = project.expectedAttendance ?? 50
        eventType = project.title
      } else {
        eventType = data.eventType
        durationDays = data.durationDays
        expectedAttendance = data.expectedAttendance
      }

      const estimate = await estimateBudgetFromHistory({
        eventType,
        durationDays,
        expectedAttendance,
        organizationId: orgId,
      })

      if (!estimate) {
        return NextResponse.json(
          fail(
            'AI_UNAVAILABLE',
            'Budget estimation is not available. Please configure GEMINI_API_KEY to enable AI estimation.',
          ),
          { status: 503 },
        )
      }

      return NextResponse.json(ok(estimate))
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
    console.error('[POST /api/events/ai/estimate-budget]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
