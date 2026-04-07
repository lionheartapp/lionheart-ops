/**
 * POST /api/events/ai/estimate-budget
 *
 * Estimates a budget for an EventProject.
 * Uses historical budget data from similar past events when available (3+),
 * falls back to AI estimation via Gemini otherwise.
 *
 * Body: { eventProjectId } or { eventType, durationDays, expectedAttendance }
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
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

export const POST = withAuth(async ({ orgId, body }) => {
  const data = body

  let eventType: string | undefined
  let durationDays: number
  let expectedAttendance: number

  if ('eventProjectId' in data) {
    // Load from event project
    const project = await (prisma as unknown as OrgPrismaClient).eventProject.findFirst({
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
}, { permission: PERMISSIONS.EVENTS_BUDGET_READ, schema: BodySchema })
